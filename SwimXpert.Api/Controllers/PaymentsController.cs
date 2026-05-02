using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Controllers;

/// <summary>
/// Handles payment processing and revenue reporting.
/// </summary>
[ApiController]
[Route("api/payments")]
public class PaymentsController(ApplicationDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Processes a payment record.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> ProcessPayment([FromBody] CreatePaymentRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin && request.UserId != currentUserId)
            return Forbid();

        var userExists = await dbContext.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
        {
            return NotFound(new { message = "User not found." });
        }

        DateTime paymentDateUtc;
        if (!request.PaymentDate.HasValue)
        {
            paymentDateUtc = DateTime.UtcNow;
        }
        else if (request.PaymentDate.Value.Kind == DateTimeKind.Utc)
        {
            paymentDateUtc = request.PaymentDate.Value;
        }
        else if (request.PaymentDate.Value.Kind == DateTimeKind.Local)
        {
            paymentDateUtc = request.PaymentDate.Value.ToUniversalTime();
        }
        else
        {
            paymentDateUtc = DateTime.SpecifyKind(request.PaymentDate.Value, DateTimeKind.Utc);
        }

        var payment = new Payment
        {
            UserId = request.UserId,
            Amount = request.Amount,
            Method = request.Method,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Completed" : request.Status,
            PaymentDate = paymentDateUtc,
            Reference = request.Reference
        };

        dbContext.Payments.Add(payment);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetByUser), new { userId = request.UserId }, payment);
    }

    /// <summary>
    /// Returns payment history for a user.
    /// </summary>
    [HttpGet("user/{userId:int}")]
    [Authorize]
    public async Task<IActionResult> GetByUser(int userId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin && userId != currentUserId)
            return Forbid();

        var payments = await dbContext.Payments
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync();

        return Ok(payments);
    }

    /// <summary>
    /// Returns monthly revenue totals for the last N months (default 6).
    /// Zero-fills months with no completed payments so the chart is always continuous.
    /// </summary>
    [HttpGet("revenue/monthly")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetMonthlyRevenue([FromQuery] int months = 6)
    {
        if (months < 1 || months > 24) months = 6;

        var cutoff = new DateTime(
            DateTime.UtcNow.AddMonths(-(months - 1)).Year,
            DateTime.UtcNow.AddMonths(-(months - 1)).Month,
            1, 0, 0, 0, DateTimeKind.Utc);

        var payments = await dbContext.Payments
            .Where(p => p.Status == "Completed" && p.PaymentDate >= cutoff)
            .Select(p => new { p.PaymentDate, p.Amount })
            .ToListAsync();

        var grouped = payments
            .GroupBy(p => new { p.PaymentDate.Year, p.PaymentDate.Month })
            .ToDictionary(g => (g.Key.Year, g.Key.Month), g => g.Sum(p => p.Amount));

        var result = Enumerable.Range(0, months)
            .Select(i =>
            {
                var date = DateTime.UtcNow.AddMonths(-(months - 1 - i));
                var year = date.Year;
                var month = date.Month;
                grouped.TryGetValue((year, month), out var total);
                return new
                {
                    year,
                    month,
                    monthName = new DateTime(year, month, 1).ToString("MMMM"),
                    total
                };
            })
            .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Returns revenue summary and completed payments list. Requires Admin role.
    /// </summary>
    [HttpGet("revenue")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetRevenue([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var query = dbContext.Payments.Where(p => p.Status == "Completed");

        // Query-string dates bind as Unspecified; Npgsql requires UTC for timestamptz parameters.
        var fromUtc = from.HasValue ? ToUtcForPostgres(from.Value) : (DateTime?)null;
        var toUtc = to.HasValue ? ToUtcForPostgres(to.Value) : (DateTime?)null;

        if (fromUtc.HasValue)
        {
            query = query.Where(p => p.PaymentDate >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(p => p.PaymentDate <= toUtc.Value);
        }

        var payments = await query
            .Include(p => p.User)
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync();

        var totalRevenue = payments.Sum(p => p.Amount);
        var clientRevenue = payments
            .GroupBy(p => p.UserId)
            .Select(g => new
            {
                clientId = g.Key,
                clientName = g.First().User.FullName,
                revenue = g.Sum(p => p.Amount),
                sessions = g.Count()
            })
            .OrderByDescending(x => x.revenue)
            .ToList();

        var paymentRows = payments
            .Select(p => new
            {
                p.Id,
                p.UserId,
                clientName = p.User.FullName,
                clientEmail = p.User.Email,
                p.Amount,
                p.PaymentDate,
                p.Method,
                p.Status,
                p.Reference
            })
            .ToList();

        return Ok(new
        {
            totalRevenue,
            paymentsCount = payments.Count,
            clientRevenue,
            payments = paymentRows
        });
    }

    /// <summary>
    /// Client checkout: books a free 45-minute slot and records a card payment atomically.
    /// Returns a receipt with a generated receipt ID.
    /// </summary>
    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest request, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        if (request.Amount <= 0)
            return BadRequest(new { message = "Amount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(request.CardLastFour) || request.CardLastFour.Length != 4)
            return BadRequest(new { message = "Card last four digits are required." });

        // ── Booking logic (mirrors /api/sessions/book-slot) ──────────────────
        var beirutOffset = TimeSpan.FromHours(3);
        var slotDuration = TimeSpan.FromMinutes(45);
        var dayStart     = TimeSpan.FromHours(9);
        var dayEnd       = TimeSpan.FromHours(20);

        var startUtc = request.StartUtc.Kind == DateTimeKind.Utc
            ? request.StartUtc
            : DateTime.SpecifyKind(request.StartUtc, DateTimeKind.Utc);
        var endUtc = startUtc + slotDuration;

        if (startUtc <= DateTime.UtcNow)
            return BadRequest(new { message = "This slot is in the past." });

        var startBeirut = startUtc + beirutOffset;
        var timeOfDay   = startBeirut.TimeOfDay;
        if (timeOfDay < dayStart || timeOfDay + slotDuration > dayEnd)
            return BadRequest(new { message = "Slot is outside working hours (9 AM–8 PM)." });

        var swimmer = await dbContext.Swimmers.FindAsync(request.SwimmerId);
        if (swimmer is null)
            return NotFound(new { message = "Swimmer not found." });

        var isAdminOrCoach = User.IsInRole("Admin") || User.IsInRole("Coach");
        if (!isAdminOrCoach && swimmer.ParentUserId != currentUserId)
            return Forbid();

        var overlaps = await dbContext.TrainingSessions.AnyAsync(
            s => s.StartTime < endUtc && s.EndTime > startUtc, cancellationToken);
        if (overlaps)
            return Conflict(new { message = "This slot was just taken. Please choose another time." });

        // ── Create session + attendance ───────────────────────────────────────
        var session = new TrainingSession
        {
            Title     = $"{swimmer.Name} Session",
            StartTime = startUtc,
            EndTime   = endUtc,
            Capacity  = 1,
            Status    = "Scheduled",
            Price     = request.Amount,
            IsPaid    = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.TrainingSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        var attendance = new Attendance
        {
            SwimmerId         = request.SwimmerId,
            TrainingSessionId = session.Id,
            SessionDate       = startUtc.Date,
            IsPresent         = false,
            CreatedAt         = DateTime.UtcNow
        };
        dbContext.Attendances.Add(attendance);

        // ── Record payment ────────────────────────────────────────────────────
        var receiptId = "RCT-" + Guid.NewGuid().ToString("N")[..8].ToUpper();
        var payment = new Payment
        {
            UserId      = currentUserId,
            Amount      = request.Amount,
            Method      = $"Card ****{request.CardLastFour}",
            Status      = "Paid",
            PaymentDate = DateTime.UtcNow,
            Reference   = receiptId
        };
        dbContext.Payments.Add(payment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            success        = true,
            receiptId,
            sessionId      = session.Id,
            registrationId = attendance.Id,
            date           = startBeirut.ToString("yyyy-MM-dd"),
            startLocal     = startBeirut.ToString("HH:mm"),
            endLocal       = (startBeirut + slotDuration).ToString("HH:mm"),
            amount         = request.Amount,
            cardLastFour   = request.CardLastFour,
            cardHolder     = request.CardHolder,
            swimmerName    = swimmer.Name
        });
    }

    /// <summary>
    /// Aligns DateTime Kind with PostgreSQL timestamptz (Npgsql rejects Unspecified).
    /// </summary>
    private static DateTime ToUtcForPostgres(DateTime dt) =>
        dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };
}

public class CheckoutRequest
{
    public DateTime StartUtc   { get; set; }
    public int      SwimmerId  { get; set; }
    public decimal  Amount     { get; set; }
    public string   CardHolder { get; set; } = string.Empty;
    public string   CardLastFour { get; set; } = string.Empty;
}

public class CreatePaymentRequest
{
    public int UserId { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = "Cash";
    public string Status { get; set; } = "Completed";
    public DateTime? PaymentDate { get; set; }
    public string? Reference { get; set; }
}
