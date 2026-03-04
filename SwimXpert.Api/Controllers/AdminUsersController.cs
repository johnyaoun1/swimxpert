using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController(ApplicationDbContext dbContext, IAuditLogService auditLog) : ControllerBase
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
                u.Id,
                u.Email,
                fullName = u.FullName,
                u.Role,
                u.IsActive,
                u.CreatedAt,
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

public class UpdateUserRequest
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}
