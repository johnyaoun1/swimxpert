using System.Text.RegularExpressions;

namespace SwimXpert.Api.Services;

/// <summary>
/// Profile photos are stored as a file locator and shown only through
/// <c>/api/profile-pictures/{file}</c>. The file name is a 32-char hex id plus a real image extension.
/// </summary>
public static partial class ProfilePictureFiles
{
    public const string RoutePrefix = "/api/profile-pictures/";

    [GeneratedRegex(@"(?:^|/)([a-f0-9]{32}\.(?:jpg|jpeg|png|gif|webp))(?:$|\?)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex FileNamePattern();

    public static bool TryGetFileName(string? value, out string fileName)
    {
        fileName = "";
        if (string.IsNullOrWhiteSpace(value))
            return false;
        var match = FileNamePattern().Match(value.Trim());
        if (!match.Success)
            return false;
        fileName = match.Groups[1].Value.ToLowerInvariant();
        return true;
    }

    public static bool IsSafeFileName(string? fileName) =>
        TryGetFileName(fileName, out var parsed) && parsed == fileName?.ToLowerInvariant();

    public static string AuthorizedPath(string fileName) => RoutePrefix + fileName.ToLowerInvariant();

    /// <summary>Value returned to browsers. Null when the row has no photo we can serve.</summary>
    public static string? ToAuthorizedPath(string? stored)
    {
        return TryGetFileName(stored, out var fileName) ? AuthorizedPath(fileName) : null;
    }

    public static string ContentType(string fileName)
    {
        return Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "image/jpeg"
        };
    }

    /// <summary>
    /// Turns an uploaded path or an already-stored locator into the value saved on the swimmer.
    /// The same file keeps its existing locator so a Cloudinary URL is not discarded on edit.
    /// </summary>
    public static bool TryStore(string? incoming, string? existing, IStorageService storage, out string? stored, out string? error)
    {
        stored = null;
        error = null;
        if (string.IsNullOrWhiteSpace(incoming))
            return true;
        if (!TryGetFileName(incoming, out var incomingName))
        {
            error = "Profile picture must be an uploaded image.";
            return false;
        }

        if (TryGetFileName(existing, out var existingName)
            && existingName.Equals(incomingName, StringComparison.OrdinalIgnoreCase))
        {
            stored = existing;
            return true;
        }

        stored = storage.ToStoredLocator(incomingName);
        return true;
    }
}
