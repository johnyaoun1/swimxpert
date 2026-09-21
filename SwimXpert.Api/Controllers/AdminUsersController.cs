using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController(
    ApplicationDbContext dbContext,
    IAuditLogService auditLog) : ControllerBase
{
    /// <summary>
    /// Returns all users.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await dbContext.Users
            .Include(u => u.Swimmers)
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                id         = u.Id,
                username   = u.Username,
                email      = u.Email,
                fullName   = u.FullName,
                role       = u.Role,
                isActive   = u.IsActive,
                isApproved = u.IsApproved,
                phone      = u.Phone,
                createdAt  = u.CreatedAt,
                swimmers = u.Swimmers
                    .OrderBy(s => s.Name)
                    .Select(s => new
                    {
                        s.Id,
                        s.Name,
                        s.Age,
                        s.Level,
                        s.ProfilePictureUrl,
                        s.SkillProgressJson,
                        s.CreatedAt
                    })
            })
            .ToListAsync();

        return Ok(users);
    }

    /// <summary>
    /// Updates role and active status.
    /// </summary>
    private static readonly HashSet<string> AllowedRoles = ["Parent", "Coach", "Admin"];

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        string? assignedRole = null;
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            assignedRole = CanonicalRole(request.Role);
            if (assignedRole is null)
                return BadRequest(new { message = "Invalid role. Allowed: Parent, Coach, Admin." });
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync();
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        var previousRole = user.Role;
        // A new Admin can only be inserted in the database. Setting Admin on anyone else is refused.
        if (assignedRole is not null && IsAdminRole(assignedRole) && !IsAdminRole(previousRole))
        {
            await auditLog.LogAsync("AdminPromotionBlocked", "User", id.ToString(), new { targetUserId = id });
            await tx.CommitAsync();
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Promoting a user to Admin is not allowed." });
        }

        var roleChanged = assignedRole is not null && !string.Equals(previousRole, assignedRole, StringComparison.Ordinal);
        var deactivates = request.IsActive == false && user.IsActive;
        var removesActiveAdmin = user.IsActive && IsAdminRole(previousRole)
            && ((assignedRole is not null && !IsAdminRole(assignedRole)) || request.IsActive == false);

        if (removesActiveAdmin && await IsLastActiveAdminAsync(user))
            return Conflict(new { message = "Cannot demote or deactivate the last active admin." });

        if (assignedRole is not null)
            user.Role = assignedRole;
        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        await dbContext.SaveChangesAsync();
        if (roleChanged)
            await auditLog.LogAsync("RoleChanged", "User", id.ToString(), new { fromRole = previousRole, toRole = user.Role });
        if (deactivates)
            await auditLog.LogAsync("UserDisabled", "User", id.ToString(), new { role = user.Role });
        if (!roleChanged && !deactivates)
            await auditLog.LogAsync("UserUpdated", "User", id.ToString(), new { request.Role, request.IsActive });
        await tx.CommitAsync();
        return Ok(new { message = "User updated successfully." });
    }

    /// <summary>
    /// Creates a client account with auto-generated credentials and emails them.
    /// Optionally creates a child (Swimmer) profile at the same time.
    /// </summary>
    [HttpPost("create-client")]
    public async Task<IActionResult> CreateClient([FromBody] CreateClientRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new { message = "Full name is required." });
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "A user with this email already exists." });

        var fullName = request.FullName.Trim();
        var passwordError = PasswordPolicy.Validate(request.Password?.Trim());
        if (passwordError is not null)
            return BadRequest(new { message = passwordError });
        var username = await GenerateUniqueUsernameAsync(fullName);
        var plainPassword = request.Password!.Trim();

        var user = new User
        {
            Email = email,
            Username = username,
            FullName = fullName,
            Phone = request.Phone?.Trim(),
            Password = BCrypt.Net.BCrypt.HashPassword(plainPassword),
            Role = "Parent",
            IsActive = true,
            IsApproved = true,
            ClientStatus = ClientStatuses.New,
            EmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        // Create child profile if provided
        string? childName = null;
        if (!string.IsNullOrWhiteSpace(request.ChildName))
        {
            childName = request.ChildName.Trim();
            var age   = request.ChildAge is > 0 ? request.ChildAge.Value : 8;
            var level = LevelLabelToNumber(request.ChildLevel);

            dbContext.Swimmers.Add(new Swimmer
            {
                ParentUserId = user.Id,
                Name         = childName,
                Age          = Math.Clamp(age, 1, 30),
                Level        = level,
                CreatedAt    = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        await auditLog.LogAsync("ClientCreated", "User", user.Id.ToString(), new { email, username, childName });

        return Ok(new { username, password = plainPassword, email });
    }

    /// <summary>
    /// Creates a coach account with admin-set password (share credentials manually; no email sent).
    /// </summary>
    [HttpPost("create-coach")]
    public async Task<IActionResult> CreateCoach([FromBody] CreateCoachRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(new { message = "Full name is required." });
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "A user with this email already exists." });

        var fullName = request.FullName.Trim();
        var passwordError = PasswordPolicy.Validate(request.Password?.Trim());
        if (passwordError is not null)
            return BadRequest(new { message = passwordError });
        var username = await GenerateUniqueUsernameAsync(fullName);
        var plainPassword = request.Password!.Trim();

        var user = new User
        {
            Email = email,
            Username = username,
            FullName = fullName,
            Phone = request.Phone?.Trim(),
            Password = BCrypt.Net.BCrypt.HashPassword(plainPassword),
            Role = "Coach",
            IsActive = true,
            IsApproved = true,
            EmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        await auditLog.LogAsync("CoachCreated", "User", user.Id.ToString(), new { email, username, role = "Coach" });

        return Ok(new { username, password = plainPassword, email });
    }

    private static int LevelLabelToNumber(string? label) => label?.Trim().ToLowerInvariant() switch
    {
        "beginner"     => 1,
        "intermediate" => 2,
        "advanced"     => 3,
        "elite"        => 4,
        _              => 1
    };

    /// <summary>
    /// Updates a client's name, email, phone and optionally resets their password.
    /// </summary>
    [HttpPut("{id:int}/update-profile")]
    public async Task<IActionResult> UpdateProfile(int id, [FromBody] UpdateProfileRequest request)
    {
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (!string.IsNullOrWhiteSpace(request.FullName))
            user.FullName = request.FullName.Trim();

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var newEmail = request.Email.Trim().ToLowerInvariant();
            if (newEmail != user.Email &&
                await dbContext.Users.AnyAsync(u => u.Email == newEmail && u.Id != id))
                return Conflict(new { message = "This email is already used by another account." });
            user.Email = newEmail;
        }

        // Phone: explicit null string "" clears it
        if (request.Phone is not null)
            user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            var passwordError = PasswordPolicy.Validate(request.NewPassword.Trim());
            if (passwordError is not null)
                return BadRequest(new { message = passwordError });
            user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword.Trim());
        }

        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("ClientProfileUpdated", "User", user.Id.ToString(),
            new { request.FullName, request.Email, hasPasswordChange = !string.IsNullOrWhiteSpace(request.NewPassword) });

        return Ok(new { message = "Profile updated." });
    }

    private async Task<string> GenerateUniqueUsernameAsync(string fullName)
    {
        // "John Yaoun" → "john.yaoun"
        var slug = Regex.Replace(fullName.Trim().ToLowerInvariant(), @"[^a-z0-9\s]", "");
        var parts = slug.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var baseUsername = parts.Length >= 2
            ? $"{parts[0]}.{parts[^1]}"
            : parts.Length == 1 ? parts[0] : "client";

        if (!await dbContext.Users.AnyAsync(u => u.Username == baseUsername))
            return baseUsername;

        for (var i = 2; i <= 999; i++)
        {
            var candidate = $"{baseUsername}{i}";
            if (!await dbContext.Users.AnyAsync(u => u.Username == candidate))
                return candidate;
        }
        return $"{baseUsername}{RandomNumberGenerator.GetInt32(1000, 9999)}";
    }

    /// <summary>
    /// Marks a client approved (legacy admin action). Dashboard access no longer depends on this.
    /// Does not generate or overwrite passwords.
    /// </summary>
    [HttpPut("{id:int}/approve")]
    public async Task<IActionResult> ApproveUser(int id, [FromBody] ApproveUserRequest? request)
    {
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        // Optional password reset only if admin explicitly sends one
        if (!string.IsNullOrWhiteSpace(request?.NewPassword))
        {
            var passwordError = PasswordPolicy.Validate(request.NewPassword);
            if (passwordError is not null)
                return BadRequest(new { message = passwordError });
            user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, 12);
        }

        user.IsApproved = true;
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserApproved", "User", id.ToString(), new { user.Email });
        return Ok(new { message = "Account marked approved.", email = user.Email });
    }

    /// <summary>
    /// Hard-deletes a self-registered (unapproved) user — reject without creating an account.
    /// Pending online session payments are marked refunded and pending slots removed.
    /// </summary>
    [HttpDelete("{id:int}/reject")]
    public async Task<IActionResult> RejectUser(int id)
    {
        await using var tx = await dbContext.Database.BeginTransactionAsync();
        var user = await dbContext.Users
            .Include(u => u.Swimmers)
            .ThenInclude(s => s.Attendances)
            .ThenInclude(a => a.TrainingSession)
            .FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound(new { message = "User not found." });
        if (user.IsActive && IsAdminRole(user.Role) && await IsLastActiveAdminAsync(user))
            return Conflict(new { message = "Cannot delete the last active admin." });
        if (user.IsApproved)
            return BadRequest(new { message = "Cannot reject an already-approved user." });

        foreach (var swimmer in user.Swimmers)
        {
            foreach (var att in swimmer.Attendances.ToList())
            {
                if (att.BookingStatus != "Pending")
                    continue;

                var held = await dbContext.Payments
                    .Where(p => p.AttendanceId == att.Id && p.Status == "Pending")
                    .ToListAsync();
                foreach (var p in held)
                    p.Status = "Refunded";

                dbContext.Attendances.Remove(att);
                if (att.TrainingSession is not null)
                    dbContext.TrainingSessions.Remove(att.TrainingSession);
            }
        }

        var stray = await dbContext.Payments
            .Where(p => p.UserId == id && p.Status == "Pending")
            .ToListAsync();
        foreach (var p in stray)
            p.Status = "Refunded";

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserRejected", "User", id.ToString(), new { user.Email });
        await tx.CommitAsync();
        return Ok(new { message = "Account rejected. Pending bookings were removed and online holds marked refunded." });
    }

    /// <summary>
    /// Soft-deletes user by disabling the account.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> SoftDeleteUser(int id)
    {
        await using var tx = await dbContext.Database.BeginTransactionAsync();
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (user.IsActive && IsAdminRole(user.Role) && await IsLastActiveAdminAsync(user))
            return Conflict(new { message = "Cannot deactivate the last active admin." });

        user.IsActive = false;
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserDisabled", "User", id.ToString(), new { role = user.Role });
        await tx.CommitAsync();
        return Ok(new { message = "User disabled successfully." });
    }

    private static bool IsAdminRole(string? role) =>
        string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);

    /// <summary>Parent, Coach, or Admin with canonical casing. Null when the value is not allowed.</summary>
    private static string? CanonicalRole(string role)
    {
        foreach (var allowed in AllowedRoles)
        {
            if (string.Equals(allowed, role.Trim(), StringComparison.OrdinalIgnoreCase))
                return allowed;
        }
        return null;
    }

    /// <summary>
    /// True when <paramref name="user"/> is the only active admin.
    /// Locks active-admin rows so two concurrent demotions cannot both succeed.
    /// Caller must already have an open transaction.
    /// </summary>
    private async Task<bool> IsLastActiveAdminAsync(User user)
    {
        if (!user.IsActive || !IsAdminRole(user.Role))
            return false;

        await dbContext.Database
            .SqlQueryRaw<int>("""SELECT "Id" AS "Value" FROM "Users" WHERE "IsActive" = TRUE AND lower("Role") = 'admin' FOR UPDATE""")
            .ToListAsync();

        return !await dbContext.Users.AnyAsync(u =>
            u.Id != user.Id && u.IsActive && u.Role.ToLower() == "admin");
    }
}

public class ApproveUserRequest
{
    public string? NewPassword { get; set; }
}

public class UpdateUserRequest
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateClientRequest
{
    public string? FullName   { get; set; }
    public string? Email      { get; set; }
    public string? Phone      { get; set; }
    public string? Password   { get; set; }
    public string? ChildName  { get; set; }
    public int?    ChildAge   { get; set; }
    public string? ChildLevel { get; set; }
}

public class CreateCoachRequest
{
    public string? FullName { get; set; }
    public string? Email    { get; set; }
    public string? Phone    { get; set; }
    public string? Password { get; set; }
}

public class UpdateProfileRequest
{
    [MaxLength(255)]
    public string? FullName    { get; set; }
    [MaxLength(255)]
    [EmailAddress]
    public string? Email       { get; set; }
    public string? Phone       { get; set; }
    public string? NewPassword { get; set; }
}
