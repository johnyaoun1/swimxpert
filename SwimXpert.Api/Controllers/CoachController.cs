using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Controllers;

/// <summary>
/// Endpoints used by the coach dashboard — sessions assigned to the logged-in coach.
/// </summary>
[ApiController]
[Route("api/coach")]
[Authorize(Roles = "Coach,Admin")]
public class CoachController(ApplicationDbContext dbContext) : ControllerBase
{
    private static readonly TimeSpan BeirutOffset = TimeSpan.FromHours(3);

    /// <summary>
    /// Returns sessions assigned to the currently logged-in coach, filtered by optional date range.
    /// </summary>
    [HttpGet("sessions")]
    public async Task<IActionResult> GetMySessions(
        [FromQuery] string? from = null,
        [FromQuery] string? to   = null)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var coachId))
            return Unauthorized(new { message = "Invalid user context." });

        var query = dbContext.TrainingSessions
            .Where(s => s.CoachUserId == coachId);

        if (!string.IsNullOrWhiteSpace(from) && DateTime.TryParse(from, out var fromDt))
            query = query.Where(s => s.EndTime >= fromDt.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(to) && DateTime.TryParse(to, out var toDt))
            query = query.Where(s => s.StartTime < toDt.ToUniversalTime());

        var sessions = await query
            .OrderBy(s => s.StartTime)
            .Select(s => new
            {
                id               = s.Id,
                title            = s.Title,
                date             = (s.StartTime + BeirutOffset).ToString("yyyy-MM-dd"),
                time             = (s.StartTime + BeirutOffset).ToString("HH:mm"),
                endTime          = (s.EndTime   + BeirutOffset).ToString("HH:mm"),
                startTimeUtc     = s.StartTime.ToString("O"),
                endTimeUtc       = s.EndTime.ToString("O"),
                poolLocation     = s.PoolLocation,
                status           = s.Status.ToLowerInvariant(),
                price            = s.Price,
                isPaid           = s.IsPaid,
                coachAccepted      = s.CoachAccepted,
                coachDeclineReason = s.CoachDeclineReason,
                recurrenceSeriesId = s.RecurrenceSeriesId
            })
            .ToListAsync();

        return Ok(sessions);
    }

    /// <summary>Coach accepts a session assigned to them.</summary>
    [HttpPut("sessions/{id:int}/accept")]
    public async Task<IActionResult> AcceptSession(int id)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var coachId))
            return Unauthorized(new { message = "Invalid user context." });

        var session = await dbContext.TrainingSessions.FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound(new { message = "Session not found." });
        if (session.CoachUserId != coachId) return Forbid();

        session.CoachAccepted = true;
        session.CoachDeclineReason = null;
        await dbContext.SaveChangesAsync();
        return Ok(new { id = session.Id, coachAccepted = session.CoachAccepted });
    }

    /// <summary>Coach declines a session assigned to them (reason required).</summary>
    [HttpPut("sessions/{id:int}/decline")]
    public async Task<IActionResult> DeclineSession(int id, [FromBody] DeclineSessionRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var coachId))
            return Unauthorized(new { message = "Invalid user context." });

        var reason = request?.Reason?.Trim() ?? string.Empty;
        if (reason.Length < 3)
            return BadRequest(new { message = "Please provide a decline reason (at least 3 characters)." });

        var session = await dbContext.TrainingSessions.FirstOrDefaultAsync(s => s.Id == id);
        if (session is null) return NotFound(new { message = "Session not found." });
        if (session.CoachUserId != coachId) return Forbid();

        session.CoachAccepted = false;
        session.CoachDeclineReason = reason.Length > 2000 ? reason[..2000] : reason;
        await dbContext.SaveChangesAsync();
        return Ok(new { id = session.Id, coachAccepted = session.CoachAccepted, coachDeclineReason = session.CoachDeclineReason });
    }

    /// <summary>
    /// Returns total revenue of accepted + paid sessions for the logged-in coach.
    /// </summary>
    [HttpGet("revenue")]
    public async Task<IActionResult> GetRevenue()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var coachId))
            return Unauthorized(new { message = "Invalid user context." });

        var total = await dbContext.TrainingSessions
            .Where(s => s.CoachUserId == coachId && s.CoachAccepted == true && s.IsPaid)
            .SumAsync(s => (decimal?)s.Price) ?? 0m;

        var acceptedCount = await dbContext.TrainingSessions
            .CountAsync(s => s.CoachUserId == coachId && s.CoachAccepted == true);

        var pendingCount = await dbContext.TrainingSessions
            .CountAsync(s => s.CoachUserId == coachId && s.CoachAccepted == null);

        return Ok(new
        {
            totalRevenue   = total,
            acceptedCount,
            pendingCount
        });
    }
}

public class DeclineSessionRequest
{
    public string? Reason { get; set; }
}
