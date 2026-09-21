namespace SwimXpert.Api.Services;

/// <summary>
/// Saves profile pictures under wwwroot/uploads/profile-pictures/.
/// That folder is not served as static files. Reads go through the authorized endpoint.
/// </summary>
public class LocalStorageService : IStorageService
{
    private readonly IWebHostEnvironment _env;

    public LocalStorageService(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async Task UploadAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        var path = ResolvePath(fileName);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var stream = new FileStream(path, FileMode.Create);
        await content.CopyToAsync(stream, ct);
    }

    public string ToStoredLocator(string fileName) => $"/uploads/profile-pictures/{fileName}";

    public Task<Stream?> OpenReadAsync(string fileName, string? storedUrl, CancellationToken ct = default)
    {
        var path = ResolvePath(fileName);
        if (!File.Exists(path))
            return Task.FromResult<Stream?>(null);
        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(stream);
    }

    private string ResolvePath(string fileName)
    {
        if (!ProfilePictureFiles.IsSafeFileName(fileName))
            throw new InvalidOperationException("Invalid file name.");

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads", "profile-pictures");
        var filePath = Path.GetFullPath(Path.Combine(uploadsDir, fileName));
        if (!filePath.StartsWith(Path.GetFullPath(uploadsDir) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
            && !filePath.StartsWith(Path.GetFullPath(uploadsDir) + Path.AltDirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Invalid file path.");
        return filePath;
    }
}
