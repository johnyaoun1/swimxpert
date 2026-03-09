namespace SwimXpert.Api.Services;

/// <summary>
/// Saves profile pictures to wwwroot/uploads/profile-pictures/ on local disk.
/// Used automatically in local development when CLOUDINARY_CLOUD_NAME is not set.
/// Returns a relative path — UploadsController prepends the request base URL.
/// </summary>
public class LocalStorageService : IStorageService
{
    private readonly IWebHostEnvironment _env;

    public LocalStorageService(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async Task<string> UploadFileAsync(IFormFile file, string fileName, CancellationToken ct = default)
    {
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads", "profile-pictures");
        Directory.CreateDirectory(uploadsDir);

        var filePath = Path.GetFullPath(Path.Combine(uploadsDir, fileName));
        if (!filePath.StartsWith(Path.GetFullPath(uploadsDir), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Invalid file path.");

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream, ct);

        return $"/uploads/profile-pictures/{fileName}";
    }
}
