using Microsoft.AspNetCore.Http;

namespace SwimXpert.Api;

/// <summary>
/// Resolves the client IP used for abuse controls (rate limiting).
///
/// Deliberately ignores X-Forwarded-For: on Railway that header arrives with
/// client-supplied entries intact, so keying on it lets a caller mint a fresh
/// rate-limit bucket per request by rotating the header.
///
/// X-Real-IP is set and always overwritten by Railway's edge proxy, and the
/// app cannot be reached without going through that proxy, so it is the
/// trustworthy source here. Falls back to the transport peer address
/// (correct for local development, where no proxy is present).
/// </summary>
public static class ClientIpResolver
{
    private const string RealIpHeader = "X-Real-IP";

    public static string Resolve(HttpContext context)
    {
        // Single, proxy-set value. If a client sends its own, the edge overwrites it.
        // Take the last value so an injected duplicate cannot win.
        if (context.Request.Headers.TryGetValue(RealIpHeader, out var realIp))
        {
            var candidate = realIp.LastOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(candidate))
                return candidate;
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
