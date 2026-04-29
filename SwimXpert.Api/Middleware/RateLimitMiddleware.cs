using System.Collections.Concurrent;

namespace SwimXpert.Api.Middleware;

/// <summary>
/// Simple fixed-window rate limiting per IP for auth and lead-capture endpoints.
/// </summary>
public class RateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly ConcurrentDictionary<string, WindowCount> AuthAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> LeadAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> ChatAttempts = new();
    private static readonly ConcurrentDictionary<string, WindowCount> PasswordAttempts = new();
    private const int AuthPermitLimit = 10;
    private const int LeadPermitLimit = 20;
    private const int ChatPermitLimit = 20;
    private const int PasswordPermitLimit = 5;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public RateLimitMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        if (path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/auth/register", StringComparison.OrdinalIgnoreCase))
        {
            if (!TryConsume(AuthAttempts, ip, AuthPermitLimit))
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"message":"Too many attempts. Please try again later."}""");
                return;
            }
        }
        else if (path.StartsWith("/api/leads/capture", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            if (!TryConsume(LeadAttempts, ip, LeadPermitLimit))
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"message":"Too many requests. Please try again later."}""");
                return;
            }
        }
        else if (path.Equals("/api/chat", StringComparison.OrdinalIgnoreCase) && method == "POST")
        {
            if (!TryConsume(ChatAttempts, ip, ChatPermitLimit))
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"message":"Too many requests. Please try again later."}""");
                return;
            }
        }
        else if ((path.StartsWith("/api/auth/forgot-password", StringComparison.OrdinalIgnoreCase)
                  || path.StartsWith("/api/auth/reset-password", StringComparison.OrdinalIgnoreCase))
                 && method == "POST")
        {
            if (!TryConsume(PasswordAttempts, ip, PasswordPermitLimit))
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"message":"Too many requests. Please try again later."}""");
                return;
            }
        }

        await _next(context);
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
