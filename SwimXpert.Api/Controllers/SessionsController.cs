using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/sessions")]
public class SessionsController(
    ApplicationDbContext dbContext,
    IAuditLogService auditLog,
    IGoogleCalendarMutationsService googleCalendarMutations) : ControllerBase
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
            Capacity = request.MaxSwimmers,
            PoolLocation = request.PoolLocation?.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Scheduled" : request.Status,
            Price = request.Price < 0 ? 0 : request.Price,
            IsPaid = request.IsPaid,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.TrainingSessions.Add(session);
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("SessionCreated", "TrainingSession", session.Id.ToString(), new { session.Title });
        var created = await dbContext.TrainingSessions
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .FirstAsync(s => s.Id == session.Id);
        return CreatedAtAction(nameof(GetSessionById), new { id = session.Id }, ToSessionDto(created));
    }

    /// <summary>
    /// Returns all sessions with optional filters. Coach/Admin only — contains client names and full registration data.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Coach,Admin")]
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
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        return Ok(sessions.Select(ToSessionDto));
    }

    // Beirut is UTC+3 (no DST)
    private static readonly TimeSpan BeirutOffset = TimeSpan.FromHours(3);
    private static readonly TimeSpan SlotDuration = TimeSpan.FromMinutes(45);
    private static readonly TimeSpan DayStart = TimeSpan.FromHours(9);   // 9:00 AM
    private static readonly TimeSpan DayEnd   = TimeSpan.FromHours(20);  // 8:00 PM

    /// <summary>
    /// Returns free 45-minute time slots (9 AM–8 PM Beirut) for the next <paramref name="days"/> days.
    /// A slot is free when no existing TrainingSession overlaps it.
    /// Client-safe: no session titles, client names, or registration data exposed.
    /// </summary>
    [HttpGet("available")]
    [Authorize]
    public async Task<IActionResult> GetAvailableSlots([FromQuery] int days = 14)
    {
        days = Math.Clamp(days, 1, 30);
        var now = DateTime.UtcNow;

        // Date range to query
        var rangeStartUtc = now;
        var rangeEndUtc   = now.AddDays(days);

        // Load all existing sessions that fall within the window (only need start/end times)
        var blocked = await dbContext.TrainingSessions
            .Where(s => s.EndTime > rangeStartUtc && s.StartTime < rangeEndUtc)
            .Select(s => new { s.StartTime, s.EndTime })
            .ToListAsync();

        var todayBeirut = (now + BeirutOffset).Date;
        var result = new List<object>();

        for (var d = 0; d < days; d++)
        {
            var dateBeirut = todayBeirut.AddDays(d);
            var slotStart  = DayStart;

            while (slotStart + SlotDuration <= DayEnd)
            {
                var startUtc = dateBeirut + slotStart - BeirutOffset;
                var endUtc   = startUtc + SlotDuration;

                // Skip slots already in the past
                if (endUtc <= now)
                {
                    slotStart += SlotDuration;
                    continue;
                }

                // Skip if any existing session overlaps this slot
                var isBlocked = blocked.Any(s => s.StartTime < endUtc && s.EndTime > startUtc);
                if (!isBlocked)
                {
                    result.Add(new
                    {
                        date       = dateBeirut.ToString("yyyy-MM-dd"),
                        startLocal = (dateBeirut + slotStart).ToString("HH:mm"),
                        endLocal   = (dateBeirut + slotStart + SlotDuration).ToString("HH:mm"),
                        startUtc   = startUtc.ToString("O"),
                        endUtc     = endUtc.ToString("O")
                    });
                }

                slotStart += SlotDuration;
            }
        }

        return Ok(result);
    }

    /// <summary>
    /// Books a free 45-minute slot for a swimmer. Creates the TrainingSession and Attendance in one step.
    /// The slot must not overlap any existing session and must be within 9 AM–8 PM Beirut time.
    /// </summary>
    [HttpPost("book-slot")]
    [Authorize]
    public async Task<IActionResult> BookSlot([FromBody] BookSlotRequest request, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var startUtc = request.StartUtc.ToUniversalTime();
        var endUtc   = startUtc + SlotDuration;

        if (startUtc <= DateTime.UtcNow)
            return BadRequest(new { message = "This slot is in the past." });

        // Validate slot falls within 9 AM–8 PM Beirut
        var startBeirut = startUtc + BeirutOffset;
        var timeOfDay   = startBeirut.TimeOfDay;
        if (timeOfDay < DayStart || timeOfDay + SlotDuration > DayEnd)
            return BadRequest(new { message = "Slot is outside working hours (9 AM–8 PM)." });

        var swimmer = await dbContext.Swimmers.FindAsync(request.SwimmerId);
        if (swimmer is null)
            return NotFound(new { message = "Swimmer not found." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");
        if (!isAdminOrCoach && swimmer.ParentUserId != currentUserId)
            return Forbid();

        // Check the slot is still free
        var overlaps = await dbContext.TrainingSessions.AnyAsync(
            s => s.StartTime < endUtc && s.EndTime > startUtc, cancellationToken);
        if (overlaps)
            return Conflict(new { message = "This slot has just been taken. Please pick another." });

        // Create the session
        var session = new TrainingSession
        {
            Title     = $"{swimmer.Name} Session",
            StartTime = startUtc,
            EndTime   = endUtc,
            Capacity  = 1,
            Status    = "Scheduled",
            Price     = 0,
            IsPaid    = false,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.TrainingSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Register the swimmer
        var attendance = new Attendance
        {
            SwimmerId         = request.SwimmerId,
            TrainingSessionId = session.Id,
            SessionDate       = startUtc.Date,
            IsPresent         = false,
            CreatedAt         = DateTime.UtcNow
        };
        dbContext.Attendances.Add(attendance);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message        = "Slot booked successfully.",
            registrationId = attendance.Id,
            date           = startBeirut.ToString("yyyy-MM-dd"),
            startLocal     = startBeirut.ToString("HH:mm"),
            endLocal       = (startBeirut + SlotDuration).ToString("HH:mm")
        });
    }

    /// <summary>
    /// Returns future sessions ordered by start time. Coach/Admin only — contains client names and full registration data.
    /// </summary>
    [HttpGet("upcoming")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> GetUpcomingSessions()
    {
        var now = DateTime.UtcNow;
        var sessions = await dbContext.TrainingSessions
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .Where(s => s.StartTime > now)
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        return Ok(sessions.Select(ToSessionDto));
    }

    /// <summary>
    /// Returns one session by id. Coach/Admin only — contains client names and full registration data.
    /// </summary>
    [HttpGet("{id:int}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> GetSessionById(int id)
    {
        var session = await dbContext.TrainingSessions
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (session is null)
        {
            return NotFound(new { message = "Session not found." });
        }

        return Ok(ToSessionDto(session));
    }

    /// <summary>
    /// Updates an existing session. Requires Coach or Admin role.
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> UpdateSession(int id, [FromBody] UpdateSessionRequest request, CancellationToken cancellationToken)
    {
        var session = await dbContext.TrainingSessions.FindAsync(new object[] { id }, cancellationToken);
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
        session.Capacity = request.MaxSwimmers;
        session.PoolLocation = request.PoolLocation?.Trim();
        session.Status = request.Status;
        session.Price = request.Price < 0 ? 0 : request.Price;
        session.IsPaid = request.IsPaid;

        var apply = NormalizeRecurrenceApply(request.RecurrenceApply);
        var anchorUtc = session.StartTime;
        var seriesId = session.RecurrenceSeriesId;

        if (apply != RecurrenceApplyKind.Single && seriesId is Guid sidSeries)
        {
            var siblingsQuery = dbContext.TrainingSessions.Where(s => s.RecurrenceSeriesId == sidSeries && s.Id != id);
            if (apply == RecurrenceApplyKind.ThisAndFollowing)
                siblingsQuery = siblingsQuery.Where(s => s.StartTime >= anchorUtc);

            var siblings = await siblingsQuery.ToListAsync(cancellationToken);
            foreach (var o in siblings)
            {
                o.Price = session.Price;
                o.PoolLocation = session.PoolLocation;
                o.IsPaid = session.IsPaid;
                o.Status = session.Status;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await PushGoogleBestEffortAsync(session, cancellationToken);
        if (apply != RecurrenceApplyKind.Single && seriesId is Guid sidPush)
        {
            var others = await dbContext.TrainingSessions
                .Where(s => s.RecurrenceSeriesId == sidPush && s.Id != id &&
                            (apply == RecurrenceApplyKind.AllInSeries || s.StartTime >= anchorUtc))
                .ToListAsync(cancellationToken);
            foreach (var o in others)
                await PushGoogleBestEffortAsync(o, cancellationToken);
        }

        await auditLog.LogAsync("SessionUpdated", "TrainingSession", id.ToString(), new { request.Title, apply });
        var updated = await dbContext.TrainingSessions
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .FirstAsync(s => s.Id == id, cancellationToken);
        return Ok(ToSessionDto(updated));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSession([FromRoute] int id, [FromQuery] string? scope, CancellationToken cancellationToken = default)
    {
        var session = await dbContext.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (session is null)
            return NotFound(new { message = "Session not found." });

        var deleteScope = NormalizeDeleteScope(scope);
        List<TrainingSession> toRemove;
        if (session.RecurrenceSeriesId is null || deleteScope == DeleteScopeKind.ThisEvent)
        {
            toRemove = [session];
        }
        else
        {
            var q = dbContext.TrainingSessions.Where(s => s.RecurrenceSeriesId == session.RecurrenceSeriesId);
            if (deleteScope == DeleteScopeKind.ThisAndFollowing)
                q = q.Where(s => s.StartTime >= session.StartTime);
            toRemove = await q.ToListAsync(cancellationToken);
        }

        foreach (var s in toRemove)
        {
            if (!string.IsNullOrEmpty(s.GoogleEventId))
            {
                var (gOk, gErr) = await googleCalendarMutations.TryDeleteGoogleEventAsync(s.GoogleEventId, cancellationToken);
                if (!gOk)
                    await auditLog.LogAsync("GoogleCalendarDeleteFailed", "TrainingSession", s.Id.ToString(), new { gErr });
            }
        }

        dbContext.TrainingSessions.RemoveRange(toRemove);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLog.LogAsync("SessionDeleted", "TrainingSession", id.ToString(), new { count = toRemove.Count, deleteScope });
        return NoContent();
    }

    /// <summary>
    /// Creates additional weekly copies of this session (same time-of-week, title, price, location, registrations).
    /// Does not sync to Google; new rows have no GoogleEventId. Skips weeks where a session with the same title and start already exists.
    /// </summary>
    [HttpPost("{id:int}/repeat-weekly")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<IActionResult> RepeatWeekly(int id, [FromBody] RepeatWeeklyRequest? request, CancellationToken cancellationToken = default)
    {
        var weeks = request?.Weeks ?? 0;
        if (weeks < 1 || weeks > 52)
            return BadRequest(new { message = "Weeks must be between 1 and 52." });

        var source = await dbContext.TrainingSessions
            .Include(s => s.Attendances)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (source is null)
            return NotFound(new { message = "Session not found." });

        var seriesId = source.RecurrenceSeriesId ?? Guid.NewGuid();
        if (source.RecurrenceSeriesId is null)
        {
            source.RecurrenceSeriesId = seriesId;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var newSessions = new List<TrainingSession>();
        var skipped = 0;

        for (var i = 1; i <= weeks; i++)
        {
            var newStart = source.StartTime.AddDays(7 * i);
            var newEnd = source.EndTime.AddDays(7 * i);

            var existsInDb = await dbContext.TrainingSessions.AsNoTracking()
                .AnyAsync(s => s.StartTime == newStart && s.Title == source.Title, cancellationToken);
            var existsInBatch = newSessions.Any(s => s.StartTime == newStart && s.Title == source.Title);
            if (existsInDb || existsInBatch)
            {
                skipped++;
                continue;
            }

            newSessions.Add(new TrainingSession
            {
                Title = source.Title,
                StartTime = newStart,
                EndTime = newEnd,
                Capacity = source.Capacity,
                PoolLocation = source.PoolLocation,
                Status = "Scheduled",
                Price = source.Price < 0 ? 0 : source.Price,
                IsPaid = false,
                GoogleEventId = null,
                RecurrenceSeriesId = seriesId,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (newSessions.Count > 0)
        {
            dbContext.TrainingSessions.AddRange(newSessions);
            await dbContext.SaveChangesAsync(cancellationToken);

            foreach (var ns in newSessions)
            {
                foreach (var a in source.Attendances)
                {
                    dbContext.Attendances.Add(new Attendance
                    {
                        SwimmerId = a.SwimmerId,
                        TrainingSessionId = ns.Id,
                        SessionDate = ns.StartTime.Date,
                        IsPresent = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);

        await auditLog.LogAsync("SessionsRepeatedWeekly", "TrainingSession", id.ToString(),
            new { weeks, created = newSessions.Count, skipped });

        return Ok(new { created = newSessions.Count, skipped, recurrenceSeriesId = seriesId });
    }

    private async Task PushGoogleBestEffortAsync(TrainingSession s, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(s.GoogleEventId)) return;
        var (gOk, gErr) = await googleCalendarMutations.TryPushSessionToGoogleAsync(s, ct);
        if (!gOk)
            await auditLog.LogAsync("GoogleCalendarPushFailed", "TrainingSession", s.Id.ToString(), new { gErr });
    }

    private enum RecurrenceApplyKind
    {
        Single,
        ThisAndFollowing,
        AllInSeries
    }

    private enum DeleteScopeKind
    {
        ThisEvent,
        ThisAndFollowing,
        AllEvents
    }

    private static RecurrenceApplyKind NormalizeRecurrenceApply(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return RecurrenceApplyKind.Single;
        return value.Trim().ToLowerInvariant() switch
        {
            "thisandfollowing" or "this_and_following" => RecurrenceApplyKind.ThisAndFollowing,
            "allinseries" or "all_in_series" or "allevents" => RecurrenceApplyKind.AllInSeries,
            _ => RecurrenceApplyKind.Single
        };
    }

    private static DeleteScopeKind NormalizeDeleteScope(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return DeleteScopeKind.ThisEvent;
        return value.Trim().ToLowerInvariant() switch
        {
            "thisandfollowing" or "this_and_following" => DeleteScopeKind.ThisAndFollowing,
            "allinseries" or "all_in_series" or "allevents" or "all" => DeleteScopeKind.AllEvents,
            _ => DeleteScopeKind.ThisEvent
        };
    }

    private static object ToSessionDto(TrainingSession s)
    {
        var registrations = s.Attendances
            .Select(a => new
            {
                id = a.Id,
                swimmerId = a.SwimmerId,
                swimmerName = a.Swimmer?.Name ?? "",
                parentUserId = a.Swimmer?.ParentUserId ?? 0,
                parentName = a.Swimmer?.ParentUser?.FullName ?? "",
                isPresent = a.IsPresent
            })
            .ToList();

        return new
        {
            id = s.Id,
            title = s.Title,
            startTime = s.StartTime,
            endTime = s.EndTime,
            maxSwimmers = s.Capacity,
            poolLocation = s.PoolLocation,
            status = s.Status,
            price = s.Price,
            isPaid = s.IsPaid,
            googleEventId = s.GoogleEventId,
            recurrenceSeriesId = s.RecurrenceSeriesId,
            createdAt = s.CreatedAt,
            registrations
        };
    }
}

public class CreateSessionRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int MaxSwimmers { get; set; } = 10;
    public string? PoolLocation { get; set; }
    public string Status { get; set; } = "Scheduled";
    public decimal Price { get; set; }
    public bool IsPaid { get; set; }
}

public class UpdateSessionRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int MaxSwimmers { get; set; } = 10;
    public string? PoolLocation { get; set; }
    public string Status { get; set; } = "Scheduled";
    public decimal Price { get; set; }
    public bool IsPaid { get; set; }

    /// <summary>single | thisAndFollowing | allInSeries — for recurring package sessions (same RecurrenceSeriesId).</summary>
    public string? RecurrenceApply { get; set; }
}

public class RepeatWeeklyRequest
{
    /// <summary>Number of future weekly occurrences to add (not including this session).</summary>
    public int Weeks { get; set; }
}

public class BookSessionRequest
{
    public int SwimmerId { get; set; }
}

public class BookSlotRequest
{
    public DateTime StartUtc { get; set; }
    public int SwimmerId { get; set; }
}
