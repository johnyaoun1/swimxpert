using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace SwimXpert.Api.Services;

/// <summary>
/// Encrypts the Google Calendar refresh token before it is written to the database.
/// Protected values from this API start with CfDJ8.
/// </summary>
public class GoogleRefreshTokenProtector
{
    public const string ProtectedPrefix = "CfDJ8";

    private readonly IDataProtector _protector;

    public GoogleRefreshTokenProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("SwimXpert.GoogleCalendar.RefreshToken");
    }

    public static bool IsProtected(string? value) =>
        !string.IsNullOrEmpty(value) && value.StartsWith(ProtectedPrefix, StringComparison.Ordinal);

    public string Protect(string plaintext)
    {
        if (IsProtected(plaintext))
            return plaintext;
        return _protector.Protect(plaintext);
    }

    /// <summary>
    /// Opens a value protected by this API. Plaintext and values that cannot be opened
    /// return null so they are never sent to Google.
    /// </summary>
    public string? Unprotect(string? stored)
    {
        if (!IsProtected(stored))
            return null;

        try
        {
            return _protector.Unprotect(stored!);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
