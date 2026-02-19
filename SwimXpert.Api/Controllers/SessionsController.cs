using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Controllers;

/// <summary>
/// Manages swim training sessions.
/// </summary>
[ApiController]
[Route("api/sessions")]
public class SessionsController(ApplicationDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Creates a new training session. Requires Coach or Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request)
    {
        if (request.EndTime <= request.StartTime)
        {
            return BadRequest(new { message = "EndTime must be after StartTime." });
        }

        var session = new TrainingSession
        {
            Title = request.Title.Trim(),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Capacity = request.Capacity,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Scheduled" : request.Status,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.TrainingSessions.Add(session);
        await dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSessionById), new { id = session.Id }, session);
    }

    /// <summary>
    /// Returns all sessions with optional filters.
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetSessions([FromQuery] string? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var query = dbContext.TrainingSessions.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(s => s.Status == status);
        }

        if (from.HasValue)
        {
            query = query.Where(s => s.StartTime >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(s => s.StartTime <= to.Value);
        }

        var sessions = await query
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        return Ok(sessions);
    }

    /// <summary>
    /// Returns future sessions ordered by start time.
    /// </summary>
    [HttpGet("upcoming")]
    [Authorize]
    public async Task<IActionResult> GetUpcomingSessions()
    {
        var now = DateTime.UtcNow;
        var sessions = await dbContext.TrainingSessions
            .Where(s => s.StartTime > now)
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        return Ok(sessions);
    }

    /// <summary>
    /// Returns one session by id.
    /// </summary>
    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetSessionById(int id)
    {
        var session = await dbContext.TrainingSessions.FindAsync(id);
        if (session is null)
        {
            return NotFound(new { message = "Session not found." });
        }

        return Ok(session);
    }

    /// <summary>
    /// Updates an existing session. Requires Coach or Admin role.
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> UpdateSession(int id, [FromBody] UpdateSessionRequest request)
    {
        var session = await dbContext.TrainingSessions.FindAsync(id);
        if (session is null)
        {
            return NotFound(new { message = "Session not found." });
        }

        if (request.EndTime <= request.StartTime)
        {
            return BadRequest(new { message = "EndTime must be after StartTime." });
        }

        session.Title = request.Title.Trim();
        session.StartTime = request.StartTime;
        session.EndTime = request.EndTime;
        session.Capacity = request.Capacity;
        session.Status = request.Status;

        await dbContext.SaveChangesAsync();
        return Ok(session);
    }

    /// <summary>
    /// Deletes a session. Requires Admin role.
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSession(int id)
    {
        var session = await dbContext.TrainingSessions.FindAsync(id);
        if (session is null)
        {
            return NotFound(new { message = "Session not found." });
        }

        dbContext.TrainingSessions.Remove(session);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateSessionRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int Capacity { get; set; } = 10;
    public string Status { get; set; } = "Scheduled";
}

public class UpdateSessionRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int Capacity { get; set; } = 10;
    public string Status { get; set; } = "Scheduled";
}
