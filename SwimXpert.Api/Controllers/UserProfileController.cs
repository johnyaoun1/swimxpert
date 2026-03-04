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
