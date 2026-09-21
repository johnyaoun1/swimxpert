using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Middleware;

/// <summary>
/// Rejects an access token whose version no longer matches the user.
/// Anonymous actions (login, refresh, logout) are not checked, so a leftover cookie cannot block them.
/// </summary>
public class TokenVersionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ApplicationDbContext db)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await next(context);
            return;
        }

        var metadata = context.GetEndpoint()?.Metadata;
        if (metadata is null
            || metadata.GetMetadata<IAllowAnonymous>() is not null
            || metadata.GetMetadata<IAuthorizeData>() is null)
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

        var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var versionRaw = user.FindFirstValue(AccessTokenClaims.Version);
        if (!int.TryParse(id, out var userId) || !int.TryParse(versionRaw, out var tokenVersion))
        {
            await RejectAsync(context);
            return;
        }

        var current = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (int?)u.TokenVersion)
            .FirstOrDefaultAsync(context.RequestAborted);

        if (current is null || current.Value != tokenVersion)
        {
            await RejectAsync(context);
            return;
        }

        await next(context);
    }

    private static async Task RejectAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { message = "Session ended. Sign in again." });
    }
}
