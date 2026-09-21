using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace SwimXpert.Api.Services;

/// <summary>
/// Uploads profile pictures to Cloudinary. The secure URL is stored on the swimmer
/// and fetched server-side. Browsers never receive that URL.
/// </summary>
public class CloudinaryStorageService : IStorageService
{
    private readonly Cloudinary _cloudinary;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<CloudinaryStorageService> _logger;
    private readonly string _cloudName;

    public CloudinaryStorageService(ILogger<CloudinaryStorageService> logger, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _cloudName = Environment.GetEnvironmentVariable("CLOUDINARY_CLOUD_NAME")
            ?? throw new InvalidOperationException("CLOUDINARY_CLOUD_NAME environment variable is required.");
        var apiKey = Environment.GetEnvironmentVariable("CLOUDINARY_API_KEY")
            ?? throw new InvalidOperationException("CLOUDINARY_API_KEY environment variable is required.");
        var apiSecret = Environment.GetEnvironmentVariable("CLOUDINARY_API_SECRET")
            ?? throw new InvalidOperationException("CLOUDINARY_API_SECRET environment variable is required.");

        _cloudinary = new Cloudinary(new Account(_cloudName, apiKey, apiSecret));
        _cloudinary.Api.Secure = true;
    }

    public async Task UploadAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(fileName, content),
            Folder = "swimxpert-profiles",
            PublicId = Path.GetFileNameWithoutExtension(fileName),
            UniqueFilename = false,
            Overwrite = true
        };

        var result = await _cloudinary.UploadAsync(uploadParams, ct);

        if (result.Error is not null)
        {
            _logger.LogError("Cloudinary upload failed: {Message}", result.Error.Message);
            throw new InvalidOperationException($"Upload failed: {result.Error.Message}");
        }
    }

    public string ToStoredLocator(string fileName)
    {
        var publicId = Path.GetFileNameWithoutExtension(fileName);
        return $"https://res.cloudinary.com/{_cloudName}/image/upload/swimxpert-profiles/{publicId}{Path.GetExtension(fileName)}";
    }

    public async Task<Stream?> OpenReadAsync(string fileName, string? storedUrl, CancellationToken ct = default)
    {
        var url = IsCloudinaryUrl(storedUrl) ? storedUrl! : ToStoredLocator(fileName);
        var client = _httpClientFactory.CreateClient();
        using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        return new MemoryStream(bytes);
    }

    private static bool IsCloudinaryUrl(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.Host.Equals("res.cloudinary.com", StringComparison.OrdinalIgnoreCase);
}
