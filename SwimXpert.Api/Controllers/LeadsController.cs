using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeadsController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpPost("capture")]
    [AllowAnonymous]
    public async Task<IActionResult> Capture([FromBody] CaptureLeadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var hasEmail = !string.IsNullOrWhiteSpace(request.Email);
        var hasPhone = !string.IsNullOrWhiteSpace(request.Phone);
        if (!hasEmail && !hasPhone)
        {
            return BadRequest(new { message = "Email or phone is required." });
        }

        var lead = new LeadCapture
        {
            Name = request.Name.Trim(),
            Email = hasEmail ? request.Email!.Trim().ToLowerInvariant() : null,
            Phone = hasPhone ? request.Phone!.Trim() : null,
            SourcePage = string.IsNullOrWhiteSpace(request.SourcePage) ? null : request.SourcePage.Trim(),
            SourceAction = string.IsNullOrWhiteSpace(request.SourceAction) ? null : request.SourceAction.Trim(),
            UserAgent = string.IsNullOrWhiteSpace(request.UserAgent) ? null : request.UserAgent.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.LeadCaptures.Add(lead);
        await dbContext.SaveChangesAsync();

        return Ok(new { id = lead.Id, message = "Lead captured." });
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? isContacted, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var query = dbContext.LeadCaptures.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(l =>
                l.Name.ToLower().Contains(term) ||
                (l.Email != null && l.Email.ToLower().Contains(term)) ||
                (l.Phone != null && l.Phone.ToLower().Contains(term)) ||
                (l.SourcePage != null && l.SourcePage.ToLower().Contains(term)) ||
                (l.SourceAction != null && l.SourceAction.ToLower().Contains(term)));
        }

        if (isContacted.HasValue)
        {
            query = query.Where(l => l.IsContacted == isContacted.Value);
        }

        if (from.HasValue)
        {
            var fromUtc = from.Value.Kind == DateTimeKind.Utc ? from.Value : DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
            query = query.Where(l => l.CreatedAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = to.Value.Kind == DateTimeKind.Utc ? to.Value : DateTime.SpecifyKind(to.Value, DateTimeKind.Utc);
            query = query.Where(l => l.CreatedAt <= toUtc);
        }

        var leads = await query
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Name,
                l.Email,
                l.Phone,
                l.SourcePage,
                l.SourceAction,
                l.IsContacted,
                l.ContactedAt,
                l.CreatedAt
            })
            .ToListAsync();

        return Ok(leads);
    }

    [HttpPut("{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateLeadStatusRequest request)
    {
        var lead = await dbContext.LeadCaptures.FirstOrDefaultAsync(l => l.Id == id);
        if (lead is null)
        {
            return NotFound(new { message = "Lead not found." });
        }

        lead.IsContacted = request.IsContacted;
        lead.ContactedAt = request.IsContacted ? DateTime.UtcNow : null;
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            lead.Id,
            lead.IsContacted,
            lead.ContactedAt
        });
    }
}

public class CaptureLeadRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? SourcePage { get; set; }
    public string? SourceAction { get; set; }
    public string? UserAgent { get; set; }
}

public class UpdateLeadStatusRequest
{
    public bool IsContacted { get; set; }
}
