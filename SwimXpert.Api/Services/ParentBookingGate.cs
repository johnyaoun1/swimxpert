using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;

namespace SwimXpert.Api.Services;

public sealed record BookingDenial(int StatusCode, string Message, string Code);

/// <summary>
/// Parents who are not approved, or who still need email verification while that
/// feature is on, cannot book. Admins and coaches are not subject to this gate.
/// </summary>
public class ParentBookingGate(ApplicationDbContext db, IConfiguration configuration, IWebHostEnvironment env)
{
    public const string PendingMessage =
        "Your account is awaiting approval. We'll confirm with you on WhatsApp.";

    private bool EmailVerificationRequired =>
        configuration.GetValue("Features:EmailVerificationRequired", false);

    /// <summary>
    /// Pending parents cannot book or upload a profile picture. Admins and coaches are skipped.
    /// </summary>
    public async Task<BookingDenial?> DenyIfParentPendingAsync(ClaimsPrincipal user, int userId, CancellationToken ct = default)
    {
        if (user.IsInRole("Admin") || user.IsInRole("Coach"))
            return null;

        var approved = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsApproved)
            .FirstOrDefaultAsync(ct);
        if (approved is null)
            return new BookingDenial(401, "Invalid user context.", "invalid_user");
        if (!approved.Value)
            return new BookingDenial(403, PendingMessage, "account_pending");
        return null;
    }

    public async Task<BookingDenial?> DenyIfParentCannotBookAsync(ClaimsPrincipal user, int userId, CancellationToken ct = default)
    {
        var pending = await DenyIfParentPendingAsync(user, userId, ct);
        if (pending is not null || user.IsInRole("Admin") || user.IsInRole("Coach"))
            return pending;

        if (!EmailVerificationRequired || env.IsDevelopment())
            return null;

        var verified = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.EmailVerified)
            .FirstOrDefaultAsync(ct);
        if (verified is null)
            return new BookingDenial(401, "Invalid user context.", "invalid_user");
        if (!verified.Value)
            return new BookingDenial(403, "Please verify your email before booking a session.", "email_not_verified");

        return null;
    }
}
