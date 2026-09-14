using Microsoft.AspNetCore.Http;

namespace SwimXpert.Api;

/// <summary>
/// Auth cookie flags for access_token / refresh_token.
/// Default topology is same-origin reverse proxy → SameSite=Strict + Secure in production.
/// Set AUTH_COOKIE_SAMESITE=None only for true cross-site frontends (also requires Secure).
/// </summary>
public static class AuthCookieSettings
{
    public static CookieOptions Create(HttpRequest request, DateTimeOffset? expires = null)
    {
        var sameSite = ParseSameSite(Environment.GetEnvironmentVariable("AUTH_COOKIE_SAMESITE"));
        var secure = ResolveSecure(request, sameSite);

        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite,
            Path = "/",
            // Host-only cookie (no Domain) — correct for same-origin proxy on the public hostname.
        };

        if (expires.HasValue)
            options.Expires = expires;

        return options;
    }

    public static CookieOptions CreateDeletion(HttpRequest request) =>
        Create(request); // Same Path/SameSite/Secure so the browser actually clears the cookie.

    private static SameSiteMode ParseSameSite(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return SameSiteMode.Strict;

        return raw.Trim().ToLowerInvariant() switch
        {
            "none" => SameSiteMode.None,
            "lax" => SameSiteMode.Lax,
            "strict" => SameSiteMode.Strict,
            _ => SameSiteMode.Strict
        };
    }

    private static bool ResolveSecure(HttpRequest request, SameSiteMode sameSite)
    {
        // Browsers require Secure when SameSite=None.
        if (sameSite == SameSiteMode.None)
            return true;

        var env = Environment.GetEnvironmentVariable("AUTH_COOKIE_SECURE");
        if (!string.IsNullOrWhiteSpace(env))
            return env.Equals("true", StringComparison.OrdinalIgnoreCase)
                || env == "1";

        var host = request.Host.Host;
        var isLocal = host is "localhost" or "127.0.0.1" or "::1";
        return !isLocal;
    }
}
