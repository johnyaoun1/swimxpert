using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api")]
public class UploadsController(IStorageService storageService, ParentBookingGate bookingGate, ApplicationDbContext db) : ControllerBase
{
    private const int MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    [HttpPost("upload/profile-picture")]
    [Authorize]
    public async Task<IActionResult> UploadProfilePicture(IFormFile? file, CancellationToken ct = default)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "Invalid user context." });

        var denial = await bookingGate.DenyIfParentPendingAsync(User, userId, ct);
        if (denial is not null)
            return StatusCode(denial.StatusCode, new { message = denial.Message, code = denial.Code });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = "File size must be 5 MB or less." });

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        if (buffer.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        buffer.Position = 0;
        var header = new byte[16];
        var read = await buffer.ReadAsync(header.AsMemory(0, header.Length), ct);
        if (!ImageSignature.TryDetect(header.AsSpan(0, read), out var extension, out _))
            return BadRequest(new { message = "Upload a JPG, PNG, GIF, or WebP image." });

        buffer.Position = 0;
        var fileName = $"{Guid.NewGuid():N}{extension}";
        await storageService.UploadAsync(buffer, fileName, ct);

        return Ok(new { url = ProfilePictureFiles.AuthorizedPath(fileName) });
    }

    /// <summary>
    /// Serves one profile photo. Allowed for the parent who owns the swimmer,
    /// a coach assigned to one of that swimmer's sessions, or an admin.
    /// </summary>
    [HttpGet("profile-pictures/{fileName}")]
    [Authorize]
    public async Task<IActionResult> GetProfilePicture(string fileName, CancellationToken ct = default)
    {
        if (!ProfilePictureFiles.IsSafeFileName(fileName))
            return NotFound();
        fileName = fileName.ToLowerInvariant();

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "Invalid user context." });

        var candidates = await db.Swimmers.AsNoTracking()
            .Where(s => s.ProfilePictureUrl != null && s.ProfilePictureUrl.Contains(fileName))
            .Select(s => new { s.Id, s.ParentUserId, s.ProfilePictureUrl })
            .ToListAsync(ct);

        var match = candidates.FirstOrDefault(s =>
            ProfilePictureFiles.TryGetFileName(s.ProfilePictureUrl, out var storedName) && storedName == fileName);
        if (match is null)
            return NotFound();

        if (!await CanViewAsync(match.Id, match.ParentUserId, userId, ct))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You cannot view this photo.", code = "forbidden" });

        var stream = await storageService.OpenReadAsync(fileName, match.ProfilePictureUrl, ct);
        if (stream is null)
            return NotFound();

        Response.Headers.CacheControl = "private";
        return File(stream, ProfilePictureFiles.ContentType(fileName));
    }

    private async Task<bool> CanViewAsync(int swimmerId, int parentUserId, int userId, CancellationToken ct)
    {
        if (User.IsInRole("Admin"))
            return true;
        if (User.IsInRole("Coach"))
        {
            return await db.Attendances.AsNoTracking().AnyAsync(
                a => a.SwimmerId == swimmerId && a.TrainingSession.CoachUserId == userId, ct);
        }

        return parentUserId == userId;
    }
}
