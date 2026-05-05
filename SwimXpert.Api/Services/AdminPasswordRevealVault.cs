using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace SwimXpert.Api.Services;

public sealed class AdminPasswordRevealVault(IConfiguration configuration, ILogger<AdminPasswordRevealVault> logger)
    : IAdminPasswordRevealVault
{
    private const byte FormatVersion = 1;
    private readonly byte[]? _key = ResolveKey(configuration, logger);

    public bool IsConfigured => _key is { Length: 32 };

    public bool TryEncrypt(string plaintext, out string ciphertextBase64)
    {
        ciphertextBase64 = "";
        if (!IsConfigured || string.IsNullOrEmpty(plaintext))
            return false;

        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        Span<byte> nonce = stackalloc byte[12];
        RandomNumberGenerator.Fill(nonce);

        var cipher = new byte[plainBytes.Length];
        Span<byte> tag = stackalloc byte[16];

        using var aes = new AesGcm(_key!, 16);
        aes.Encrypt(nonce, plainBytes, cipher, tag);

        var packed = new byte[1 + nonce.Length + cipher.Length + tag.Length];
        packed[0] = FormatVersion;
        nonce.CopyTo(packed.AsSpan(1));
        Buffer.BlockCopy(cipher, 0, packed, 13, cipher.Length);
        tag.CopyTo(packed.AsSpan(13 + cipher.Length));

        ciphertextBase64 = Convert.ToBase64String(packed);
        return true;
    }

    public bool TryDecrypt(string ciphertextBase64, out string plaintext)
    {
        plaintext = "";
        if (!IsConfigured || string.IsNullOrWhiteSpace(ciphertextBase64))
            return false;

        byte[] packed;
        try
        {
            packed = Convert.FromBase64String(ciphertextBase64.Trim());
        }
        catch
        {
            return false;
        }

        if (packed.Length < 1 + 12 + 16 + 1 || packed[0] != FormatVersion)
            return false;

        var nonce = packed.AsSpan(1, 12);
        var tag = packed.AsSpan(packed.Length - 16, 16);
        var cipherLen = packed.Length - 13 - 16;
        if (cipherLen < 1)
            return false;

        var cipher = new byte[cipherLen];
        Buffer.BlockCopy(packed, 13, cipher, 0, cipherLen);

        var plain = new byte[cipherLen];
        try
        {
            using var aes = new AesGcm(_key!, 16);
            aes.Decrypt(nonce, cipher, tag, plain);
        }
        catch
        {
            return false;
        }

        plaintext = Encoding.UTF8.GetString(plain);
        return true;
    }

    private static byte[]? ResolveKey(IConfiguration configuration, ILogger logger)
    {
        var raw = configuration["ADMIN_PASSWORD_REVEAL_KEY"]
                  ?? configuration["AdminPasswordReveal:Key"]
                  ?? Environment.GetEnvironmentVariable("ADMIN_PASSWORD_REVEAL_KEY");

        if (string.IsNullOrWhiteSpace(raw))
        {
            logger.LogWarning(
                "Admin password reveal is disabled: set ADMIN_PASSWORD_REVEAL_KEY env var or AdminPasswordReveal:Key " +
                "(e.g. dotnet user-secrets set \"AdminPasswordReveal:Key\" \"your-long-secret\") — then restart the API.");
            return null;
        }

        raw = raw.Trim();

        try
        {
            if (raw.Length == 64 && Regex.IsMatch(raw, "^[a-fA-F0-9]+$"))
                return Convert.FromHexString(raw);

            try
            {
                var fromB64 = Convert.FromBase64String(raw);
                if (fromB64.Length == 32)
                    return fromB64;
            }
            catch (FormatException)
            {
                /* use passphrase hash */
            }

            return SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Invalid AdminPasswordReveal key format.");
            return null;
        }
    }
}
