namespace SwimXpert.Api.Services;

/// <summary>Detects an image type from its leading bytes. The client filename is ignored.</summary>
public static class ImageSignature
{
    public static bool TryDetect(ReadOnlySpan<byte> header, out string extension, out string contentType)
    {
        extension = "";
        contentType = "";
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            extension = ".jpg";
            contentType = "image/jpeg";
            return true;
        }

        if (header.Length >= 8
            && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
            && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
        {
            extension = ".png";
            contentType = "image/png";
            return true;
        }

        if (header.Length >= 6
            && header[0] == (byte)'G' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'8'
            && (header[4] == (byte)'7' || header[4] == (byte)'9') && header[5] == (byte)'a')
        {
            extension = ".gif";
            contentType = "image/gif";
            return true;
        }

        if (header.Length >= 12
            && header[0] == (byte)'R' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'F'
            && header[8] == (byte)'W' && header[9] == (byte)'E' && header[10] == (byte)'B' && header[11] == (byte)'P')
        {
            extension = ".webp";
            contentType = "image/webp";
            return true;
        }

        return false;
    }
}
