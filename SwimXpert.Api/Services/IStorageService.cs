namespace SwimXpert.Api.Services;

/// <summary>
/// Abstracts file storage so the upload controller works with both
/// Cloudinary (production) and local disk (development) without changes.
/// </summary>
public interface IStorageService
{
    /// <summary>
    /// Uploads the file and returns its publicly accessible URL.
    /// CloudinaryStorageService always returns a full https:// URL.
    /// LocalStorageService returns a relative path (e.g. /uploads/profile-pictures/abc.jpg).
    /// </summary>
    Task<string> UploadFileAsync(IFormFile file, string fileName, CancellationToken ct = default);
}
