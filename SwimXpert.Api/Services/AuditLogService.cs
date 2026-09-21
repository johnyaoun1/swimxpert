using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Services;

public interface IAuditLogService
{
    Task LogAsync(string action, string? targetType = null, string? targetId = null, object? details = null, CancellationToken ct = default);
}

public class AuditLogService : IAuditLogService
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditLogService(ApplicationDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogAsync(string action, string? targetType = null, string? targetId = null, object? details = null, CancellationToken ct = default)
    {
        var http = _httpContextAccessor.HttpContext;
        if (http?.User?.Identity?.IsAuthenticated != true) return;
        var userId = http.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = http.User.FindFirstValue(ClaimTypes.Email) ?? "";
        if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out var adminId)) return;

        var entry = new AuditLog
        {
            AdminUserId = adminId,
            AdminEmail = email,
            Action = action.Length > 100 ? action[..100] : action,
            TargetType = targetType?.Length > 100 ? targetType[..100] : targetType,
            TargetId = targetId?.Length > 50 ? targetId[..50] : targetId,
            Details = details == null ? null : JsonSerializer.Serialize(details),
            Timestamp = DateTime.UtcNow,
            // Proxy-set client IP (same source as rate limiting) — not RemoteIpAddress,
            // which X-Forwarded-For spoofing can poison.
            IpAddress = TruncateIp(ClientIpResolver.Resolve(http))
        };
        _db.AuditLogs.Add(entry);
        await _db.SaveChangesAsync(ct);
    }

    // AuditLogs.IpAddress is varchar(45). Values that cannot fit are stored as null,
    // matching the previous RemoteIpAddress truncation.
    private static string? TruncateIp(string? ip) =>
        string.IsNullOrEmpty(ip) || ip.Length > 45 ? null : ip;
}
