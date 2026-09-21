using System.Security.Cryptography;

namespace SwimXpert.Api.Services;

/// <summary>
/// One-time password an admin can read aloud or send on WhatsApp.
/// Avoids characters that are easy to mix up (0/O, 1/I/l).
/// </summary>
public static class TemporaryPassword
{
    private const string Uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lowers = "abcdefghjkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    private const string All = Uppers + Lowers + Digits;

    public static string Generate(int length = 12)
    {
        if (length < 3)
            length = 12;

        var chars = new char[length];
        chars[0] = Uppers[RandomNumberGenerator.GetInt32(Uppers.Length)];
        chars[1] = Digits[RandomNumberGenerator.GetInt32(Digits.Length)];
        chars[2] = Lowers[RandomNumberGenerator.GetInt32(Lowers.Length)];
        for (var i = 3; i < length; i++)
            chars[i] = All[RandomNumberGenerator.GetInt32(All.Length)];

        for (var i = chars.Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars);
    }
}
