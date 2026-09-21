using System.Collections.Concurrent;
using System.Security.Claims;

namespace SwimXpert.Api.Middleware;

/// <summary>
/// Fixed-window rate limits. Anonymous endpoints key off <see cref="ClientIpResolver"/>.
/// Authenticated /api calls share one bucket per user id.
/// Runs after authentication so the name-identifier claim is available.
/// </summary>
public class RateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly ConcurrentDictionary<string, WindowCount> AuthAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> LeadAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> PasswordAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> RefreshAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> LevelFinderAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> UserAttempts = new();
    private const int AuthPermitLimit = 10;
    private const int LeadPermitLimit = 20;
    private const int PasswordPermitLimit = 5;
    private const int RefreshPermitLimit = 10;
    private const int LevelFinderPermitLimit = 20;
    private const int UserPermitLimit = 300;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public RateLimitMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;
        // Proxy-set client IP — not X-Forwarded-For, which the caller can rotate to
        // mint a fresh bucket per request.
        var ip = ClientIpResolver.Resolve(context);

        // CORS preflight must not consume rate-limit slots (and must reach UseCors).
        if (HttpMethods.IsOptions(method))
        {
            await _next(context);
            return;
        }

        if (path.StartsWith("/api/auth/refresh", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            if (!TryConsume(RefreshAttempts, ip, RefreshPermitLimit))
            {
                await RejectAsync(context);
                return;
            }
        }
        else if (path.StartsWith("/api/level-finder/analyze", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            if (!TryConsume(LevelFinderAttempts, ip, LevelFinderPermitLimit))
            {
                await RejectAsync(context);
                return;
            }
        }
        else if (path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/auth/register", StringComparison.OrdinalIgnoreCase))
        {
            if (!TryConsume(AuthAttempts, ip, AuthPermitLimit))
            {
                await RejectAsync(context, "Too many attempts. Please try again later.");
                return;
            }
        }
        else if (path.StartsWith("/api/leads/capture", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            if (!TryConsume(LeadAttempts, ip, LeadPermitLimit))
            {
                await RejectAsync(context);
                return;
            }
        }
        else if ((path.StartsWith("/api/auth/forgot-password", StringComparison.OrdinalIgnoreCase)
                  || path.StartsWith("/api/auth/reset-password", StringComparison.OrdinalIgnoreCase))
                 && method == "POST")
        {
            if (!TryConsume(PasswordAttempts, ip, PasswordPermitLimit))
            {
                await RejectAsync(context);
                return;
            }
        }
        else if (context.User.Identity?.IsAuthenticated == true
                 && path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            var key = string.IsNullOrEmpty(userId) ? "ip:" + ip : "user:" + userId;
            if (!TryConsume(UserAttempts, key, UserPermitLimit))
            {
                await RejectAsync(context);
                return;
            }
        }

        await _next(context);
    }

    private static async Task RejectAsync(HttpContext context, string message = "Too many requests. Please try again later.")
    {
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync($"{{\"message\":\"{message}\"}}");
    }

    private static bool TryConsume(ConcurrentDictionary<string, WindowCount> store, string key, int limit)
    {
        var now = DateTime.UtcNow;
        var entry = store.AddOrUpdate(key,
            _ => new WindowCount(now, 1),
            (_, w) =>
            {
                if (now - w.WindowStart > Window)
                    return new WindowCount(now, 1);
                if (w.Count >= limit)
                    return new WindowCount(w.WindowStart, w.Count + 1);
                return new WindowCount(w.WindowStart, w.Count + 1);
            });
        return entry.Count <= limit;
    }

    private record WindowCount(DateTime WindowStart, int Count);
}
