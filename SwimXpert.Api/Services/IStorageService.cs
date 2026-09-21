namespace SwimXpert.Api.Services;

/// <summary>
/// Abstracts file storage so uploads work with Cloudinary (production) or local disk (development).
/// Stored locators are not public URLs. Photos are read back only by an authorized endpoint.
/// </summary>
public interface IStorageService
{
    /// <summary>Saves the already-validated image bytes under <paramref name="fileName"/>.</summary>
    Task UploadAsync(Stream content, string fileName, CancellationToken ct = default);

    /// <summary>Locator persisted on the swimmer. Not returned to the browser.</summary>
    string ToStoredLocator(string fileName);

    /// <summary>Opens a previously stored image. <paramref name="storedUrl"/> is the swimmer's locator.</summary>
    Task<Stream?> OpenReadAsync(string fileName, string? storedUrl, CancellationToken ct = default);
}
