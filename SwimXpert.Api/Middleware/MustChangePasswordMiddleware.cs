using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;

namespace SwimXpert.Api.Middleware;

/// <summary>
/// After an admin sets a temporary password, the account can only read /me,
/// change that password, refresh, or log out until MustChangePassword is cleared.
/// The flag is read from the database so a current access token is blocked immediately.
/// </summary>
public class MustChangePasswordMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> AllowedPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/change-password",
        "/api/auth/logout",
        "/api/auth/me",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/validate-token"
    };

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext db)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await next(context);
            return;
        }

        var user = context.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;
        if (AllowedPaths.Contains(path))
        {
            await next(context);
            return;
        }

        var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(id, out var userId))
        {
            await next(context);
            return;
        }

        var mustChange = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.MustChangePassword)
            .FirstOrDefaultAsync(context.RequestAborted);

        if (mustChange == true)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Set a new password before continuing.",
                code = "must_change_password"
            });
            return;
        }

        await next(context);
    }
}
