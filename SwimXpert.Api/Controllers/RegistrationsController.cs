using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Controllers;

/// <summary>
/// Manages swimmer registrations and attendance records.
/// </summary>
[ApiController]
[Route("api/registrations")]
public class RegistrationsController(ApplicationDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Returns all registrations with swimmer and session details. Admin/Coach only.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> GetAll()
    {
        var registrations = await dbContext.Attendances
            .Include(a => a.Swimmer)
                .ThenInclude(s => s.ParentUser)
            .Include(a => a.TrainingSession)
            .OrderByDescending(a => a.SessionDate)
            .Select(a => new
            {
                a.Id,
                a.SwimmerId,
                swimmerName = a.Swimmer.Name,
                parentUserId = a.Swimmer.ParentUserId,
                parentName = a.Swimmer.ParentUser.FullName,
                a.TrainingSessionId,
                sessionTitle = a.TrainingSession.Title,
                startTime = a.TrainingSession.StartTime,
                endTime = a.TrainingSession.EndTime,
                a.IsPresent,
                a.SessionDate,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(registrations);
    }

    /// <summary>
    /// Registers a swimmer to a session.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Register([FromBody] CreateRegistrationRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var swimmer = await dbContext.Swimmers.FindAsync(request.SwimmerId);
        if (swimmer is null)
            return NotFound(new { message = "Swimmer not found." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");
        if (!isAdminOrCoach && swimmer.ParentUserId != currentUserId)
            return Forbid();

        var session = await dbContext.TrainingSessions.FindAsync(request.TrainingSessionId);
        if (session is null)
        {
            return NotFound(new { message = "Session not found." });
        }

        var alreadyRegistered = await dbContext.Attendances.AnyAsync(a =>
            a.SwimmerId == request.SwimmerId && a.TrainingSessionId == request.TrainingSessionId);
        if (alreadyRegistered)
        {
            return Conflict(new { message = "Swimmer is already registered for this session." });
        }

        var currentCount = await dbContext.Attendances.CountAsync(a => a.TrainingSessionId == request.TrainingSessionId);
        if (currentCount >= session.Capacity)
        {
            return BadRequest(new { message = "Session is full." });
        }

        var registration = new Attendance
        {
            SwimmerId = request.SwimmerId,
            TrainingSessionId = request.TrainingSessionId,
            SessionDate = session.StartTime.Date,
            IsPresent = false,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Attendances.Add(registration);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = registration.Id }, new RegistrationResponse
        {
            Id = registration.Id,
            SwimmerId = registration.SwimmerId,
            TrainingSessionId = registration.TrainingSessionId,
            SessionDate = registration.SessionDate,
            IsPresent = registration.IsPresent
        });
    }

    /// <summary>
    /// Returns attendees for a session.
    /// Admin/Coach see all attendees; Parent sees only their own children.
    /// </summary>
    [HttpGet("session/{sessionId:int}")]
    [Authorize]
    public async Task<IActionResult> GetBySession(int sessionId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");

        IQueryable<Attendance> query = dbContext.Attendances
            .Where(a => a.TrainingSessionId == sessionId);

        if (!isAdminOrCoach)
            query = query.Where(a => a.Swimmer.ParentUserId == currentUserId);

        var attendees = await query
            .Include(a => a.Swimmer)
            .OrderBy(a => a.Swimmer.Name)
            .Select(a => new
            {
                a.Id,
                a.SwimmerId,
                swimmerName = a.Swimmer.Name,
                a.IsPresent,
                a.SessionDate
            })
            .ToListAsync();

        return Ok(attendees);
    }

    /// <summary>
    /// Returns all registrations for a swimmer.
    /// </summary>
    [HttpGet("swimmer/{swimmerId:int}")]
    [Authorize]
    public async Task<IActionResult> GetBySwimmer(int swimmerId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var swimmer = await dbContext.Swimmers.FindAsync(swimmerId);
        if (swimmer is null)
            return NotFound(new { message = "Swimmer not found." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");
        if (!isAdminOrCoach && swimmer.ParentUserId != currentUserId)
            return Forbid();

        var registrations = await dbContext.Attendances
            .Where(a => a.SwimmerId == swimmerId)
            .Include(a => a.TrainingSession)
            .OrderByDescending(a => a.SessionDate)
            .Select(a => new
            {
                a.Id,
                a.TrainingSessionId,
                sessionTitle = a.TrainingSession.Title,
                startTime = a.TrainingSession.StartTime,
                endTime = a.TrainingSession.EndTime,
                a.IsPresent,
                a.SessionDate
            })
            .ToListAsync();

        return Ok(registrations);
    }

    /// <summary>
    /// Marks attendance status for a registration.
    /// </summary>
    [HttpPut("{id:int}/attendance")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> MarkAttendance(int id, [FromBody] MarkAttendanceRequest request)
    {
        var registration = await dbContext.Attendances.FindAsync(id);
        if (registration is null)
        {
            return NotFound(new { message = "Registration not found." });
        }

        registration.IsPresent = request.IsPresent;
        await dbContext.SaveChangesAsync();
        return Ok(new RegistrationResponse
        {
            Id = registration.Id,
            SwimmerId = registration.SwimmerId,
            TrainingSessionId = registration.TrainingSessionId,
            SessionDate = registration.SessionDate,
            IsPresent = registration.IsPresent
        });
    }

    /// <summary>
    /// Cancels a registration.
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> CancelRegistration(int id)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var registration = await dbContext.Attendances
            .Include(a => a.Swimmer)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (registration is null)
            return NotFound(new { message = "Registration not found." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");
        if (!isAdminOrCoach && registration.Swimmer.ParentUserId != currentUserId)
            return Forbid();

        dbContext.Attendances.Remove(registration);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Returns one registration by id.
    /// </summary>
    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetById(int id)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var registration = await dbContext.Attendances
            .Include(a => a.Swimmer)
            .Include(a => a.TrainingSession)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (registration is null)
            return NotFound(new { message = "Registration not found." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");
        if (!isAdminOrCoach && registration.Swimmer.ParentUserId != currentUserId)
            return Forbid();

        return Ok(new
        {
            registration.Id,
            registration.SwimmerId,
            swimmerName = registration.Swimmer.Name,
            registration.TrainingSessionId,
            sessionTitle = registration.TrainingSession.Title,
            startTime = registration.TrainingSession.StartTime,
            endTime = registration.TrainingSession.EndTime,
            registration.IsPresent,
            registration.SessionDate
        });
    }
}

public class CreateRegistrationRequest
{
    public int SwimmerId { get; set; }
    public int TrainingSessionId { get; set; }
}

public class MarkAttendanceRequest
{
    public bool IsPresent { get; set; }
}

public class RegistrationResponse
{
    public int Id { get; set; }
    public int SwimmerId { get; set; }
    public int TrainingSessionId { get; set; }
    public DateTime SessionDate { get; set; }
    public bool IsPresent { get; set; }
}
