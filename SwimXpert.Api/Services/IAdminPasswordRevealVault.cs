namespace SwimXpert.Api.Services;

/// <summary>
/// Encrypts the login password for admin-only retrieval (AES-GCM).
/// Login still uses BCrypt; this is an encrypted backup for operators who must recover credentials.
/// </summary>
public interface IAdminPasswordRevealVault
{
    bool IsConfigured { get; }

    bool TryEncrypt(string plaintext, out string ciphertextBase64);

    bool TryDecrypt(string ciphertextBase64, out string plaintext);
}
