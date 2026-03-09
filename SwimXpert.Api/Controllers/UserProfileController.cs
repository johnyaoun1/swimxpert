using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/user")]
public class UserProfileController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet("quiz-results")]
    [Authorize]
    public async Task<IActionResult> GetQuizResults()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "Invalid user context." });

        var results = await dbContext.QuizResults
            .Where(q => q.UserId == userId)
            .OrderByDescending(q => q.Percentage)
            .ThenByDescending(q => q.Timestamp)
            .Take(10)
            .Select(q => new
            {
                q.Id,
                q.Score,
                q.TotalQuestions,
                q.Percentage,
                timestamp = q.Timestamp
            })
            .ToListAsync();

        return Ok(results);
    }

    /// <summary>
    /// Returns the top-10 quiz leaderboard.
    /// Only exposes rank, anonymised display name, and score data — never email or userId.
    /// </summary>
    [HttpGet("leaderboard")]
    [Authorize]
    public async Task<IActionResult> GetLeaderboard()
    {
        var raw = await dbContext.QuizResults
            .Include(q => q.User)
            .Select(q => new
            {
                q.UserId,
                q.User.FullName,
                q.Score,
                q.TotalQuestions,
                q.Percentage,
                q.Timestamp
            })
            .ToListAsync();

        var leaderboard = raw
            .GroupBy(q => q.UserId)
            .Select(g =>
            {
                var best = g
                    .OrderByDescending(q => q.Percentage)
                    .ThenByDescending(q => q.Score)
                    .First();

                var parts = best.FullName.Trim()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var firstName = parts.Length > 0 ? parts[0] : "User";
                var lastInitial = parts.Length > 1 && parts[^1].Length > 0
                    ? char.ToUpper(parts[^1][0]) + "."
                    : string.Empty;
                var displayName = lastInitial.Length > 0
                    ? $"{firstName} {lastInitial}"
                    : firstName;

                return new
                {
                    displayName,
                    score = best.Score,
                    totalQuestions = best.TotalQuestions,
                    percentage = best.Percentage,
                    date = best.Timestamp.ToString("yyyy-MM-dd")
                };
            })
            .OrderByDescending(x => x.percentage)
            .ThenByDescending(x => x.score)
            .Take(10)
            .Select((x, i) => new
            {
                rank = i + 1,
                x.displayName,
                x.score,
                x.totalQuestions,
                x.percentage,
                x.date
            })
            .ToList();

        return Ok(leaderboard);
    }

    [HttpPost("quiz-results")]
    [Authorize]
    public async Task<IActionResult> AddQuizResult([FromBody] AddQuizResultRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "Invalid user context." });

        var quizResult = new Models.QuizResult
        {
            UserId = userId,
            Score = request.Score,
            TotalQuestions = request.TotalQuestions,
            Percentage = request.Percentage,
            Timestamp = DateTime.UtcNow
        };

        dbContext.QuizResults.Add(quizResult);
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            quizResult.Id,
            quizResult.Score,
            quizResult.TotalQuestions,
            quizResult.Percentage,
            timestamp = quizResult.Timestamp
        });
    }
}

public class AddQuizResultRequest
{
    public int Score { get; set; }
    public int TotalQuestions { get; set; }
    public int Percentage { get; set; }
}
