using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SwimXpert.Api.Services;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api")]
public class UploadsController(IStorageService storageService) : ControllerBase
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
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

        var fileName = $"{Guid.NewGuid():N}{ext}";
        var url = await storageService.UploadFileAsync(file, fileName, ct);

        // LocalStorageService returns a relative path — make it absolute for the response.
        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = $"{Request.Scheme}://{Request.Host}{url}";

        return Ok(new { url });
    }
}
