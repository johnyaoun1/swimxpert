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
    IGoogleCalendarMutationsService googleCalendarMutations,
    IWebHostEnvironment env) : ControllerBase
{
    /// <summary>
    /// Creates a new training session. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
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
            CoachUserId = request.CoachUserId,
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
        return CreatedAtAction(nameof(GetSessionById), new { id = session.Id },
            ToSessionDto(created, callerUserId: 0, isAdmin: true, isCoach: false, registeredCount: created.Attendances?.Count ?? 0));
    }

    /// <summary>
    /// Returns sessions with optional filters. Admin sees full registrant PII.
    /// A coach sees parent and child details only on sessions assigned to them (CoachUserId).
    /// Parents see session logistics for all sessions in range, but registrant names only for their own children.
    /// Defaults to upcoming window (now → +90 days) when from/to are omitted. Paginated.
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetSessions(
        [FromQuery] string? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!TryGetCallerContext(out var currentUserId, out var isAdmin, out var isCoach))
            return Unauthorized(new { message = "Invalid user context." });

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var (fromUtc, toUtc) = ResolveSessionRange(from, to);

        var query = dbContext.TrainingSessions.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        query = query.Where(s => s.StartTime >= fromUtc && s.StartTime <= toUtc);

        var totalCount = await query.CountAsync();

        var sessions = await query
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .OrderBy(s => s.StartTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var counts = await CountRegistrationsBySessionIdsAsync(sessions.Select(s => s.Id));

        return Ok(new
        {
            page,
            pageSize,
            totalCount,
            from = fromUtc,
            to = toUtc,
            items = sessions.Select(s => ToSessionDto(s, currentUserId, isAdmin, isCoach, counts.GetValueOrDefault(s.Id)))
        });
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

        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin && swimmer.ParentUserId != currentUserId)
            return Forbid();

        if (!isAdmin)
        {
            var parent = await dbContext.Users.AsNoTracking()
                .Select(u => new { u.Id, u.EmailVerified })
                .FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);
            if (parent is null)
                return Unauthorized(new { message = "Invalid user context." });
            if (!parent.EmailVerified && !env.IsDevelopment())
                return StatusCode(403, new
                {
                    message = "Please verify your email before booking a session.",
                    code = "email_not_verified"
                });
        }

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

        // Register the swimmer — clients get Pending, admins/coaches get Confirmed immediately
        var isAdminBooking = User.IsInRole("Admin");
        var attendance = new Attendance
        {
            SwimmerId         = request.SwimmerId,
            TrainingSessionId = session.Id,
            SessionDate       = startUtc.Date,
            IsPresent         = false,
            BookingStatus     = isAdminBooking ? "Confirmed" : "Pending",
            CreatedAt         = DateTime.UtcNow
        };
        dbContext.Attendances.Add(attendance);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message        = isAdminBooking ? "Slot booked successfully." : "Booking request submitted. Awaiting admin confirmation.",
            registrationId = attendance.Id,
            bookingStatus  = attendance.BookingStatus,
            date           = startBeirut.ToString("yyyy-MM-dd"),
            startLocal     = startBeirut.ToString("HH:mm"),
            endLocal       = (startBeirut + SlotDuration).ToString("HH:mm")
        });
    }

    /// <summary>
    /// Returns all Pending bookings — for admin approval queue.
    /// </summary>
    [HttpGet("bookings/pending")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetPendingBookings()
    {
        var rows = await dbContext.Attendances
            .Where(a => a.BookingStatus == "Pending")
            .Include(a => a.TrainingSession)
            .Include(a => a.Swimmer)
                .ThenInclude(sw => sw.ParentUser)
            .OrderBy(a => a.TrainingSession!.StartTime)
            .ToListAsync();

        var ids = rows.Select(a => a.Id).ToList();
        var payByAtt = await dbContext.Payments
            .AsNoTracking()
            .Where(p => p.AttendanceId.HasValue && ids.Contains(p.AttendanceId.Value))
            .GroupBy(p => p.AttendanceId!.Value)
            .ToDictionaryAsync(g => g.Key, g => g.First());

        var pending = rows.Select(a =>
        {
            payByAtt.TryGetValue(a.Id, out var op);
            return new
            {
                a.Id,
                a.BookingStatus,
                // FLAG(Booking=Child): Attendance.SwimmerId is the booking subject — may be a
                // child OR the account holder (IsAccountHolder). Do not assume ParentUser ≠ swimmer.
                swimmer = new
                {
                    a.Swimmer.Id,
                    a.Swimmer.Name,
                    a.Swimmer.Level,
                    isAccountHolder = a.Swimmer.IsAccountHolder
                },
                client = new
                {
                    a.Swimmer.ParentUser!.Id,
                    a.Swimmer.ParentUser.FullName,
                    a.Swimmer.ParentUser.Email,
                    isApproved = a.Swimmer.ParentUser.IsApproved,
                    clientStatus = a.Swimmer.ParentUser.ClientStatus,
                    emailVerified = a.Swimmer.ParentUser.EmailVerified
                },
                session = new
                {
                    a.TrainingSession!.Id,
                    a.TrainingSession.Title,
                    startTime = a.TrainingSession.StartTime,
                    endTime   = a.TrainingSession.EndTime
                },
                sessionPrice = a.TrainingSession.Price,
                a.SessionDate,
                a.CreatedAt,
                onlinePayment = op == null
                    ? null
                    : new { op.Status, op.Amount, op.Method }
            };
        }).ToList();

        return Ok(pending);
    }

    /// <summary>
    /// Admin approves a pending booking.
    /// </summary>
    [HttpPut("bookings/{id:int}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveBooking(int id)
    {
        var attendance = await dbContext.Attendances
            .Include(a => a.Swimmer).ThenInclude(s => s.ParentUser)
            .Include(a => a.TrainingSession)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (attendance is null)
            return NotFound(new { message = "Booking not found." });

        if (attendance.Swimmer.ParentUser is null)
            return BadRequest(new { message = "Booking has no linked client account." });

        var heldPayments = await dbContext.Payments
            .Where(p => p.AttendanceId == id && p.Status == "Pending")
            .ToListAsync();
        foreach (var p in heldPayments)
        {
            p.Status = "Completed";
            p.PaymentDate = DateTime.UtcNow;
        }

        if (heldPayments.Count > 0 && attendance.TrainingSession is not null)
            attendance.TrainingSession.IsPaid = true;

        attendance.BookingStatus = "Confirmed";
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("BookingApproved", "Attendance", id.ToString());
        return Ok(new { message = "Booking confirmed.", bookingStatus = "Confirmed" });
    }

    /// <summary>
    /// Admin rejects and removes a pending booking + its training session.
    /// </summary>
    [HttpDelete("bookings/{id:int}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectBooking(int id)
    {
        var attendance = await dbContext.Attendances
            .Include(a => a.TrainingSession)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (attendance is null)
            return NotFound(new { message = "Booking not found." });

        var held = await dbContext.Payments
            .Where(p => p.AttendanceId == id && p.Status == "Pending")
            .ToListAsync();
        foreach (var p in held)
            p.Status = "Refunded";

        var session = attendance.TrainingSession;
        dbContext.Attendances.Remove(attendance);
        if (session is not null)
            dbContext.TrainingSessions.Remove(session);
        await dbContext.SaveChangesAsync();
        await auditLog.LogAsync("BookingRejected", "Attendance", id.ToString());
        return Ok(new { message = "Booking rejected. Any pending online payment was marked as refunded." });
    }

    /// <summary>
    /// Returns future sessions ordered by start time (paginated). Same PII rules as GET /.
    /// </summary>
    [HttpGet("upcoming")]
    [Authorize]
    public async Task<IActionResult> GetUpcomingSessions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (!TryGetCallerContext(out var currentUserId, out var isAdmin, out var isCoach))
            return Unauthorized(new { message = "Invalid user context." });

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var now = DateTime.UtcNow;
        var toUtc = now.AddDays(90);

        var query = dbContext.TrainingSessions.AsNoTracking()
            .Where(s => s.StartTime > now && s.StartTime <= toUtc);

        var totalCount = await query.CountAsync();

        var sessions = await query
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .OrderBy(s => s.StartTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var counts = await CountRegistrationsBySessionIdsAsync(sessions.Select(s => s.Id));

        return Ok(new
        {
            page,
            pageSize,
            totalCount,
            from = now,
            to = toUtc,
            items = sessions.Select(s => ToSessionDto(s, currentUserId, isAdmin, isCoach, counts.GetValueOrDefault(s.Id)))
        });
    }

    /// <summary>
    /// Returns one session by id. Admin receives full registrant PII. A coach receives it only
    /// when CoachUserId is that coach. Parents only receive registrant PII for their own children.
    /// </summary>
    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetSessionById(int id)
    {
        if (!TryGetCallerContext(out var currentUserId, out var isAdmin, out var isCoach))
            return Unauthorized(new { message = "Invalid user context." });

        var session = await dbContext.TrainingSessions
            .AsNoTracking()
            .Include(s => s.Attendances)
                .ThenInclude(a => a.Swimmer)
                    .ThenInclude(sw => sw.ParentUser)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (session is null)
            return NotFound(new { message = "Session not found." });

        // Independent of Include / visible registrations — occupancy cannot be accidentally zeroed by PII filtering.
        var registeredCount = await dbContext.Attendances.AsNoTracking()
            .CountAsync(a => a.TrainingSessionId == id);
        return Ok(ToSessionDto(session, currentUserId, isAdmin, isCoach, registeredCount));
    }

    /// <summary>
    /// Updates an existing session. Requires Admin role.
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
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
        if (request.ClearCoach == true)
        {
            session.CoachUserId = null;
            session.CoachAccepted = null;
            session.CoachDeclineReason = null;
        }
        else if (request.CoachUserId.HasValue)
        {
            session.CoachUserId = request.CoachUserId;
            session.CoachAccepted = null;
            session.CoachDeclineReason = null;
        }

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
        var registeredCount = await dbContext.Attendances.AsNoTracking()
            .CountAsync(a => a.TrainingSessionId == id, cancellationToken);
        return Ok(ToSessionDto(updated, callerUserId: 0, isAdmin: true, isCoach: false, registeredCount));
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
    [Authorize(Roles = "Admin")]
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

    private bool TryGetCallerContext(out int userId, out bool isAdmin, out bool isCoach)
    {
        userId = 0;
        isAdmin = User.IsInRole("Admin");
        isCoach = User.IsInRole("Coach");
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(claim, out userId);
    }

    /// <summary>
    /// Default window: now → +90 days. Caps span at 366 days.
    /// </summary>
    private static (DateTime fromUtc, DateTime toUtc) ResolveSessionRange(DateTime? from, DateTime? to)
    {
        static DateTime ToUtc(DateTime dt) =>
            dt.Kind switch
            {
                DateTimeKind.Utc => dt,
                DateTimeKind.Local => dt.ToUniversalTime(),
                _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
            };

        var now = DateTime.UtcNow;
        DateTime fromUtc;
        DateTime toUtc;

        if (!from.HasValue && !to.HasValue)
        {
            fromUtc = now;
            toUtc = now.AddDays(90);
        }
        else if (from.HasValue && !to.HasValue)
        {
            fromUtc = ToUtc(from.Value);
            toUtc = fromUtc.AddDays(90);
        }
        else if (!from.HasValue && to.HasValue)
        {
            toUtc = ToUtc(to.Value);
            fromUtc = toUtc.AddDays(-90);
        }
        else
        {
            fromUtc = ToUtc(from!.Value);
            toUtc = ToUtc(to!.Value);
        }

        if (toUtc < fromUtc)
            (fromUtc, toUtc) = (toUtc, fromUtc);

        if ((toUtc - fromUtc).TotalDays > 366)
            toUtc = fromUtc.AddDays(366);

        return (fromUtc, toUtc);
    }

    private async Task<Dictionary<int, int>> CountRegistrationsBySessionIdsAsync(IEnumerable<int> sessionIds)
    {
        var ids = sessionIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<int, int>();

        return await dbContext.Attendances.AsNoTracking()
            .Where(a => ids.Contains(a.TrainingSessionId))
            .GroupBy(a => a.TrainingSessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SessionId, x => x.Count);
    }

    /// <param name="callerUserId">Logged-in user. Admin create/update passes 0; those calls set <paramref name="isAdmin"/>.</param>
    /// <param name="registeredCount">
    /// Total attendance rows for the session from a separate COUNT(*) — never derived from the
    /// filtered registrations list.
    /// </param>
    private static object ToSessionDto(TrainingSession s, int callerUserId, bool isAdmin, bool isCoach, int registeredCount)
    {
        // Parents only. Coaches are not filtered as parents; their PII gate is session ownership.
        int? parentFilterId = !isAdmin && !isCoach ? callerUserId : null;
        var coachOwnsSession = isCoach && s.CoachUserId == callerUserId;
        var fullRegistrants = isAdmin || coachOwnsSession;

        IEnumerable<Attendance> visibleAttendances = s.Attendances ?? [];
        if (isCoach && !isAdmin && !coachOwnsSession)
            visibleAttendances = [];
        else if (!fullRegistrants && parentFilterId.HasValue)
            visibleAttendances = visibleAttendances.Where(a => a.Swimmer?.ParentUserId == parentFilterId.Value);

        var hasOwnRegistration = parentFilterId.HasValue
            && (s.Attendances?.Any(a => a.Swimmer?.ParentUserId == parentFilterId.Value) ?? false);

        // Titles often embed a child's name — hide unless the caller is allowed to see registrants.
        var title = fullRegistrants || hasOwnRegistration
            ? s.Title
            : "Swimming Session";

        var registrations = visibleAttendances
            .Select(a => new
            {
                id = a.Id,
                swimmerId = a.SwimmerId,
                swimmerName = a.Swimmer?.Name ?? "",
                parentUserId = fullRegistrants ? (a.Swimmer?.ParentUserId ?? 0) : (parentFilterId ?? 0),
                parentName = fullRegistrants ? (a.Swimmer?.ParentUser?.FullName ?? "") : "",
                isPresent = a.IsPresent,
                bookingStatus = a.BookingStatus
            })
            .ToList();

        var staffSchedule = isAdmin || isCoach;
        return new
        {
            id = s.Id,
            title,
            startTime = s.StartTime,
            endTime = s.EndTime,
            maxSwimmers = s.Capacity,
            registeredCount,
            spotsRemaining = Math.Max(0, s.Capacity - registeredCount),
            poolLocation = s.PoolLocation,
            status = s.Status,
            price = s.Price,
            isPaid = s.IsPaid,
            googleEventId = staffSchedule ? s.GoogleEventId : null,
            recurrenceSeriesId = s.RecurrenceSeriesId,
            coachUserId = staffSchedule ? s.CoachUserId : null,
            coachAccepted = staffSchedule ? s.CoachAccepted : null,
            coachDeclineReason = isAdmin || coachOwnsSession ? s.CoachDeclineReason : null,
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
    public int? CoachUserId { get; set; }
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
    public int? CoachUserId { get; set; }
    public bool? ClearCoach { get; set; }

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
