using System.ComponentModel.DataAnnotations;
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
    private static readonly HashSet<string> AllowedMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "Cash", "Card", "Transfer", "Bank Transfer", "WhatsApp", "Other"
    };

    /// <summary>
    /// Staff-only: records a completed offline payment (cash / transfer / in-person card).
    /// Parents cannot create payment records.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Coach")]
    public async Task<IActionResult> ProcessPayment([FromBody] CreatePaymentRequest request)
    {
        if (request is null)
            return BadRequest(new { message = "Request body is required." });

        if (request.UserId <= 0)
            return BadRequest(new { message = "A valid client userId is required." });

        if (request.Amount < 0.01m || request.Amount > 1_000_000m)
            return BadRequest(new { message = "Amount must be between 0.01 and 1,000,000." });

        var method = string.IsNullOrWhiteSpace(request.Method) ? "Cash" : request.Method.Trim();
        if (method.Length > 30)
            method = method[..30];
        if (!AllowedMethods.Contains(method))
            return BadRequest(new { message = $"Method must be one of: {string.Join(", ", AllowedMethods.OrderBy(m => m))}." });

        var userExists = await dbContext.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
            return NotFound(new { message = "User not found." });

        // If tied to a session, amount must match the session fee when a fee is set.
        if (request.TrainingSessionId is int sessionId)
        {
            var session = await dbContext.TrainingSessions.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == sessionId);
            if (session is null)
                return NotFound(new { message = "Training session not found." });

            if (session.Price > 0 && request.Amount != session.Price)
            {
                return BadRequest(new
                {
                    message = $"Amount must match the session price ({session.Price:0.00}).",
                    sessionPrice = session.Price
                });
            }
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

        // Status is never taken from the client. Staff recording always creates a Completed ledger row.
        var reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim();
        if (reference is { Length: > 100 })
            reference = reference[..100];

        var payment = new Payment
        {
            UserId = request.UserId,
            Amount = request.Amount,
            Method = method,
            Status = "Completed",
            PaymentDate = paymentDateUtc,
            Reference = reference
        };

        dbContext.Payments.Add(payment);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetByUser), new { userId = request.UserId }, new
        {
            payment.Id,
            payment.UserId,
            payment.Amount,
            payment.Method,
            payment.Status,
            payment.PaymentDate,
            payment.Reference
        });
    }

    /// <summary>
    /// Payment history for one user. Admin may read any user. A parent may read only
    /// their own. Coaches are refused: Payment has no recorder column, so this list
    /// cannot be limited to payments that coach recorded.
    /// </summary>
    [HttpGet("user/{userId:int}")]
    [Authorize]
    public async Task<IActionResult> GetByUser(int userId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user context." });

        if (User.IsInRole("Coach"))
            return Forbid();

        if (!User.IsInRole("Admin") && userId != currentUserId)
            return Forbid();

        var payments = await dbContext.Payments
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.PaymentDate)
            .Select(p => new
            {
                p.Id,
                p.UserId,
                p.Amount,
                p.Method,
                p.Status,
                p.PaymentDate,
                p.Reference
            })
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
            .Where(p => p.UserId.HasValue)
            .GroupBy(p => p.UserId!.Value)
            .Select(g => new
            {
                clientId = g.Key,
                clientName = g.First().User != null ? g.First().User!.FullName : "(removed client)",
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
                clientName = p.User != null ? p.User.FullName : "(removed client)",
                clientEmail = p.User != null ? p.User.Email : null,
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
    /// Online card checkout is disabled for this deployment. Use POST /api/payments (manual record) instead.
    /// </summary>
    [HttpPost("checkout")]
    [Authorize]
    public IActionResult CheckoutDisabled()
    {
        return StatusCode(410, new
        {
            message = "Online checkout is not available. Payments are recorded manually by staff after cash, transfer, or in-person card payment."
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

/// <summary>
/// Staff manual payment recording. Status is never accepted from the client.
/// </summary>
public class CreatePaymentRequest
{
    [Required]
    public int UserId { get; set; }

    [Range(typeof(decimal), "0.01", "1000000")]
    public decimal Amount { get; set; }

    [MaxLength(30)]
    public string Method { get; set; } = "Cash";

    /// <summary>Ignored. Server always records Status = Completed for staff entries.</summary>
    public string? Status { get; set; }

    public DateTime? PaymentDate { get; set; }

    [MaxLength(100)]
    public string? Reference { get; set; }

    /// <summary>Optional. When set and the session has Price &gt; 0, Amount must equal that price.</summary>
    public int? TrainingSessionId { get; set; }
}
