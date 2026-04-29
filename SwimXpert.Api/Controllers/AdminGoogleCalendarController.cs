using System.Security.Claims;
using SwimXpert.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SwimXpert.Api.Data;
using SwimXpert.Api.Options;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/admin/google-calendar")]
[Authorize(Roles = "Admin")]
public class AdminGoogleCalendarController(
    ApplicationDbContext db,
    IMemoryCache cache,
    IOptions<GoogleCalendarOptions> options,
    IGoogleCalendarSyncService syncService) : ControllerBase
{
    private readonly GoogleCalendarOptions _opt = options.Value;

    private static string ScopeString => string.Join(' ', GoogleCalendarScopes.Values);

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var row = await db.GoogleCalendarStates.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);
        var connected = !string.IsNullOrEmpty(row?.RefreshToken);
        return Ok(new
        {
            connected,
            lastSyncUtc = row?.LastSyncUtc,
            calendarIdConfigured = !string.IsNullOrWhiteSpace(_opt.CalendarId),
            oauthConfigured = !string.IsNullOrWhiteSpace(_opt.ClientId) && !string.IsNullOrWhiteSpace(_opt.ClientSecret)
        });
    }

    /// <summary>Begin OAuth: open the returned URL in the same browser tab.</summary>
    [HttpGet("authorization-url")]
    public IActionResult GetAuthorizationUrl()
    {
        if (string.IsNullOrWhiteSpace(_opt.ClientId) || string.IsNullOrWhiteSpace(_opt.ClientSecret))
            return BadRequest(new { message = "Google OAuth is not configured (ClientId/ClientSecret)." });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var state = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
        cache.Set($"gcal_oauth_{state}", userId, TimeSpan.FromMinutes(10));

        var redirectUri = $"{_opt.PublicApiBaseUrl.TrimEnd('/')}/api/google-oauth/callback";
        var url =
            "https://accounts.google.com/o/oauth2/v2/auth" +
            "?client_id=" + Uri.EscapeDataString(_opt.ClientId) +
            "&redirect_uri=" + Uri.EscapeDataString(redirectUri) +
            "&response_type=code" +
            "&scope=" + Uri.EscapeDataString(ScopeString) +
            "&access_type=offline" +
            "&prompt=consent" +
            "&state=" + Uri.EscapeDataString(state);

        return Ok(new { url });
    }

    [HttpPost("sync")]
    public async Task<IActionResult> PostSync(CancellationToken cancellationToken)
    {
        var result = await syncService.SyncAsync(cancellationToken);
        if (result.Errors.Count > 0 && result.Created == 0 && result.Updated == 0 && result.CancelledInDb == 0)
            return BadRequest(new { message = string.Join(" ", result.Errors), result });

        return Ok(result);
    }

    [HttpPost("disconnect")]
    public async Task<IActionResult> PostDisconnect()
    {
        var row = await db.GoogleCalendarStates.FirstOrDefaultAsync(s => s.Id == 1);
        if (row is null)
            return Ok(new { message = "Nothing to disconnect." });

        row.RefreshToken = null;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Disconnected." });
    }
}
