using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Options;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/google-oauth")]
public class GoogleOAuthController(
    ApplicationDbContext db,
    IMemoryCache cache,
    IHttpClientFactory httpFactory,
    IOptions<GoogleCalendarOptions> options,
    ILogger<GoogleOAuthController> log) : ControllerBase
{
    private readonly GoogleCalendarOptions _opt = options.Value;

    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, CancellationToken cancellationToken)
    {
        var frontend = _opt.FrontendRedirectBaseUrl.TrimEnd('/');

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
        {
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("Missing code or state.")}");
        }

        if (!cache.TryGetValue($"gcal_oauth_{state}", out object? cacheEntry) || cacheEntry is not string adminUserId || adminUserId.Length == 0)
        {
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("OAuth session expired. Try Connect again.")}");
        }

        cache.Remove($"gcal_oauth_{state}");

        if (string.IsNullOrWhiteSpace(_opt.ClientId) || string.IsNullOrWhiteSpace(_opt.ClientSecret))
        {
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("Server OAuth not configured.")}");
        }

        var redirectUri = $"{_opt.PublicApiBaseUrl.TrimEnd('/')}/api/google-oauth/callback";
        var client = httpFactory.CreateClient();
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = _opt.ClientId,
            ["client_secret"] = _opt.ClientSecret,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code"
        });

        HttpResponseMessage tokenResp;
        try
        {
            tokenResp = await client.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Google token exchange failed");
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("Token request failed.")}");
        }

        var json = await tokenResp.Content.ReadAsStringAsync(cancellationToken);
        if (!tokenResp.IsSuccessStatusCode)
        {
            log.LogWarning("Google token error: {Body}", json);
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("Google refused the authorization.")}");
        }

        string? refresh;
        try
        {
            using var doc = JsonDocument.Parse(json);
            refresh = doc.RootElement.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        }
        catch
        {
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("Invalid token response.")}");
        }

        if (string.IsNullOrEmpty(refresh))
        {
            return Redirect($"{frontend}/admin/schedule?googleError={Uri.EscapeDataString("No refresh token. Revoke SwimXpert access at myaccount.google.com/permissions and connect again.")}");
        }

        var row = await db.GoogleCalendarStates.FirstOrDefaultAsync(s => s.Id == 1, cancellationToken);
        if (row is null)
        {
            row = new GoogleCalendarState { Id = 1 };
            db.GoogleCalendarStates.Add(row);
        }

        row.RefreshToken = refresh;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Redirect($"{frontend}/admin/schedule?googleConnected=1");
    }
}
