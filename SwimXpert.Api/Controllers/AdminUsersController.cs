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
public class AdminUsersController(ApplicationDbContext dbContext, IAuditLogService auditLog, IEmailService emailService) : ControllerBase
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
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var role = request.Role.Trim();
            if (!AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { message = "Invalid role. Allowed: Parent, Coach, Admin." });
            user.Role = role;
        }

        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserUpdated", "User", id.ToString(), new { request.Role, request.IsActive });
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
        var username = await GenerateUniqueUsernameAsync(fullName);
        var plainPassword = string.IsNullOrWhiteSpace(request.Password)
            ? GenerateSecurePassword()
            : request.Password.Trim();

        var user = new User
        {
            Email = email,
            Username = username,
            FullName = fullName,
            Phone = request.Phone?.Trim(),
            Password = BCrypt.Net.BCrypt.HashPassword(plainPassword),
            Role = "Parent",
            IsActive = true,
            IsApproved = true,   // admin-created accounts are approved immediately
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
        var username = await GenerateUniqueUsernameAsync(fullName);
        var plainPassword = string.IsNullOrWhiteSpace(request.Password)
            ? GenerateSecurePassword()
            : request.Password.Trim();
        if (plainPassword.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

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

        await auditLog.LogAsync("CoachCreated", "User", user.Id.ToString(), new { email, username });

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
            user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword.Trim());

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

    private static string GenerateSecurePassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghjkmnpqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "!@#$%^&*";
        const string all = upper + lower + digits + symbols;

        var password = new char[12];
        password[0] = upper[RandomNumberGenerator.GetInt32(upper.Length)];
        password[1] = lower[RandomNumberGenerator.GetInt32(lower.Length)];
        password[2] = digits[RandomNumberGenerator.GetInt32(digits.Length)];
        password[3] = symbols[RandomNumberGenerator.GetInt32(symbols.Length)];
        for (var i = 4; i < 12; i++)
            password[i] = all[RandomNumberGenerator.GetInt32(all.Length)];

        // Fisher-Yates shuffle
        for (var i = 11; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (password[i], password[j]) = (password[j], password[i]);
        }
        return new string(password);
    }

    /// <summary>
    /// Approves a self-registered user, moving them into the active client list.
    /// </summary>
    [HttpPut("{id:int}/approve")]
    public async Task<IActionResult> ApproveUser(int id, [FromBody] ApproveUserRequest request)
    {
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (string.IsNullOrWhiteSpace(request?.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { message = "A password of at least 6 characters is required to accept this account." });

        user.Password   = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, 12);
        user.IsApproved = true;
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserApproved", "User", id.ToString(), new { user.Email });
        return Ok(new { message = "Account accepted.", password = request.NewPassword });
    }

    /// <summary>
    /// Hard-deletes a self-registered (unapproved) user — reject without creating an account.
    /// </summary>
    [HttpDelete("{id:int}/reject")]
    public async Task<IActionResult> RejectUser(int id)
    {
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
            return NotFound(new { message = "User not found." });
        if (user.IsApproved)
            return BadRequest(new { message = "Cannot reject an already-approved user." });

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserRejected", "User", id.ToString(), new { user.Email });
        return Ok(new { message = "Account rejected and removed." });
    }

    /// <summary>
    /// Soft-deletes user by disabling the account.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> SoftDeleteUser(int id)
    {
        var user = await dbContext.Users.FindAsync(id);
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.IsActive = false;
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("UserDisabled", "User", id.ToString());
        return Ok(new { message = "User disabled successfully." });
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
