using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api")]
public class UploadsController : ControllerBase
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
    private const int MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    [HttpPost("upload/profile-picture")]
    [Authorize]
    public async Task<IActionResult> UploadProfilePicture(IFormFile? file, CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = "File size must be 5 MB or less." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext))
            return BadRequest(new { message = "Allowed formats: JPG, PNG, GIF, WebP." });

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "profile-pictures");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.GetFullPath(Path.Combine(uploadsDir, fileName));
        if (!filePath.StartsWith(Path.GetFullPath(uploadsDir), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Invalid file path." });

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, ct);
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var url = $"{baseUrl}/uploads/profile-pictures/{fileName}";

        return Ok(new { url });
    }
}
