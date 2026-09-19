using System.Text.RegularExpressions;

namespace SwimXpert.Api.Services;

/// <summary>Shared password strength rules for register / reset / admin-set passwords.</summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const int MaxLength = 128;

    private static readonly Regex HasUpper = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex HasDigit = new("[0-9]", RegexOptions.Compiled);

    /// <summary>Returns null if valid; otherwise a user-facing error message.</summary>
    public static string? Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return "Password is required.";
        if (password.Length < MinLength)
            return $"Password must be at least {MinLength} characters.";
        if (password.Length > MaxLength)
            return "Password is too long.";
        if (!HasUpper.IsMatch(password))
            return "Password must include at least one uppercase letter.";
        if (!HasDigit.IsMatch(password))
            return "Password must include at least one number.";
        return null;
    }
}
