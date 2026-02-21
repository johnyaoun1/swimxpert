using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/swimmerskills")]
public class SwimmerSkillsController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateSwimmer([FromBody] CreateSwimmerRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user context." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var parentUserId = currentUserId;
        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase) && request.ParentUserId.HasValue)
        {
            parentUserId = request.ParentUserId.Value;
        }

        var parentExists = await dbContext.Users.AnyAsync(u => u.Id == parentUserId);
        if (!parentExists)
        {
            return NotFound(new { message = "Parent user not found." });
        }

        var swimmer = new Models.Swimmer
        {
            ParentUserId = parentUserId,
            Name = request.Name.Trim(),
            Age = request.Age,
            Level = Math.Clamp(request.Level <= 0 ? 1 : request.Level, 1, 6),
            ProfilePictureUrl = string.IsNullOrWhiteSpace(request.ProfilePictureUrl) ? null : request.ProfilePictureUrl.Trim(),
            SkillProgressJson = "{}",
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Swimmers.Add(swimmer);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetMySwimmers), new { id = swimmer.Id }, BuildSwimmerCardResponse(
            swimmer.Id,
            swimmer.ParentUserId,
            swimmer.Name,
            swimmer.Age,
            swimmer.Level,
            swimmer.ProfilePictureUrl,
            swimmer.SkillProgressJson
        ));
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMySwimmers()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Invalid user context." });
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var swimmersQuery = role.Equals("Admin", StringComparison.OrdinalIgnoreCase)
            ? dbContext.Swimmers.AsQueryable()
            : dbContext.Swimmers.Where(s => s.ParentUserId == userId);

        var swimmers = await swimmersQuery
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                s.Id,
                s.ParentUserId,
                s.Name,
                s.Age,
                s.Level,
                s.ProfilePictureUrl,
                s.SkillProgressJson
            })
            .ToListAsync();

        return Ok(swimmers.Select(s => BuildSwimmerCardResponse(s.Id, s.ParentUserId, s.Name, s.Age, s.Level, s.ProfilePictureUrl, s.SkillProgressJson)));
    }

    [HttpPut("{swimmerId:int}/skills")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleSkill(int swimmerId, [FromBody] ToggleSkillRequest request)
    {
        var swimmer = await dbContext.Swimmers.FindAsync(swimmerId);
        if (swimmer is null)
        {
            return NotFound(new { message = "Swimmer not found." });
        }

        if (!SwimSkillCatalog.Levels.TryGetValue(request.Level, out var skillsInLevel))
        {
            return BadRequest(new { message = "Invalid level." });
        }

        if (!skillsInLevel.Contains(request.SkillName))
        {
            return BadRequest(new { message = "Skill does not belong to the specified level." });
        }

        var progress = ParseSkillProgress(swimmer.SkillProgressJson);
        if (!progress.TryGetValue(request.Level, out var unlocked))
        {
            unlocked = [];
            progress[request.Level] = unlocked;
        }

        if (request.IsUnlocked)
        {
            unlocked.Add(request.SkillName);
        }
        else
        {
            unlocked.Remove(request.SkillName);
        }

        swimmer.SkillProgressJson = JsonSerializer.Serialize(progress.ToDictionary(x => x.Key, x => x.Value.ToList()));
        swimmer.Level = CalculateLevel(progress);

        await dbContext.SaveChangesAsync();

        return Ok(BuildSwimmerCardResponse(
            swimmer.Id,
            swimmer.ParentUserId,
            swimmer.Name,
            swimmer.Age,
            swimmer.Level,
            swimmer.ProfilePictureUrl,
            swimmer.SkillProgressJson
        ));
    }

    private static int CalculateLevel(Dictionary<int, HashSet<string>> progress)
    {
        var currentLevel = 1;
        foreach (var (level, skills) in SwimSkillCatalog.Levels.OrderBy(x => x.Key))
        {
            var unlocked = progress.TryGetValue(level, out var set) ? set : [];
            var allUnlocked = skills.All(unlocked.Contains);
            if (!allUnlocked)
            {
                return Math.Max(currentLevel, level);
            }

            currentLevel = Math.Min(level + 1, SwimSkillCatalog.Levels.Keys.Max());
        }

        return currentLevel;
    }

    private static Dictionary<int, HashSet<string>> ParseSkillProgress(string? skillProgressJson)
    {
        if (string.IsNullOrWhiteSpace(skillProgressJson))
        {
            return [];
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, List<string>>>(skillProgressJson) ?? [];
            return parsed
                .Where(kvp => int.TryParse(kvp.Key, out _))
                .ToDictionary(
                    kvp => int.Parse(kvp.Key),
                    kvp => kvp.Value?.ToHashSet() ?? []
                );
        }
        catch
        {
            return [];
        }
    }

    private static object BuildSwimmerCardResponse(int id, int parentUserId, string name, int age, int level, string? profilePictureUrl, string skillProgressJson)
    {
        var progress = ParseSkillProgress(skillProgressJson);

        var levels = SwimSkillCatalog.Levels
            .OrderBy(x => x.Key)
            .Select(x =>
            {
                var unlockedSet = progress.TryGetValue(x.Key, out var set) ? set : [];
                var skills = x.Value.Select(skill => new
                {
                    name = skill,
                    isUnlocked = unlockedSet.Contains(skill)
                }).ToList();

                var unlockedCount = skills.Count(s => s.isUnlocked);
                var completionPercent = skills.Count == 0 ? 0 : (int)Math.Round(unlockedCount * 100.0 / skills.Count);

                return new
                {
                    level = x.Key,
                    completionPercent,
                    skills
                };
            })
            .ToList();

        return new
        {
            id,
            parentUserId,
            name,
            age,
            level,
            profilePictureUrl,
            levels
        };
    }
}

public class ToggleSkillRequest
{
    public int Level { get; set; }
    public string SkillName { get; set; } = string.Empty;
    public bool IsUnlocked { get; set; }
}

public class CreateSwimmerRequest
{
    public int? ParentUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public int Level { get; set; } = 1;
    public string? ProfilePictureUrl { get; set; }
}
