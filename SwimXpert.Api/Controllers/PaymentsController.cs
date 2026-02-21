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
        var payments = await dbContext.Payments
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync();

        return Ok(payments);
    }

    /// <summary>
    /// Returns revenue summary and completed payments list. Requires Admin role.
    /// </summary>
    [HttpGet("revenue")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetRevenue([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var query = dbContext.Payments.Where(p => p.Status == "Completed");

        if (from.HasValue)
        {
            query = query.Where(p => p.PaymentDate >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(p => p.PaymentDate <= to.Value);
        }

        var payments = await query
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync();

        var totalRevenue = payments.Sum(p => p.Amount);
        return Ok(new
        {
            totalRevenue,
            paymentsCount = payments.Count,
            payments
        });
    }
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
