using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace SwimXpert.Api.Services;

/// <summary>
/// Uploads profile pictures to Cloudinary and returns permanent secure URLs.
/// Activated automatically on Railway when CLOUDINARY_CLOUD_NAME is present.
/// Required env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
/// </summary>
public class CloudinaryStorageService : IStorageService
{
    private readonly Cloudinary _cloudinary;
    private readonly ILogger<CloudinaryStorageService> _logger;

    public CloudinaryStorageService(ILogger<CloudinaryStorageService> logger)
    {
        _logger = logger;

        var cloudName = Environment.GetEnvironmentVariable("CLOUDINARY_CLOUD_NAME")
            ?? throw new InvalidOperationException("CLOUDINARY_CLOUD_NAME environment variable is required.");
        var apiKey = Environment.GetEnvironmentVariable("CLOUDINARY_API_KEY")
            ?? throw new InvalidOperationException("CLOUDINARY_API_KEY environment variable is required.");
        var apiSecret = Environment.GetEnvironmentVariable("CLOUDINARY_API_SECRET")
            ?? throw new InvalidOperationException("CLOUDINARY_API_SECRET environment variable is required.");

        _cloudinary = new Cloudinary(new Account(cloudName, apiKey, apiSecret));
        _cloudinary.Api.Secure = true;
    }

    public async Task<string> UploadFileAsync(IFormFile file, string fileName, CancellationToken ct = default)
    {
        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(fileName, stream),
            Folder = "swimxpert-profiles",
            PublicId = Path.GetFileNameWithoutExtension(fileName),
            UniqueFilename = false,
            Overwrite = true
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error is not null)
        {
            _logger.LogError("Cloudinary upload failed: {Message}", result.Error.Message);
            throw new InvalidOperationException($"Upload failed: {result.Error.Message}");
        }

        return result.SecureUrl.ToString();
    }
}
