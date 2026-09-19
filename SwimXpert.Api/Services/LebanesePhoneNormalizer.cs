using System.Text.RegularExpressions;

namespace SwimXpert.Api.Services;

/// <summary>
/// Lebanese phone normalization for matching legacy clients.
/// Output form: digits only with country code 961 when resolvable, e.g. 96176144927.
/// </summary>
public static class LebanesePhoneNormalizer
{
    private static readonly Regex DigitsOnly = new(@"\D+", RegexOptions.Compiled);

    // Mobile leading digits after national trunk 0 (or after 961)
    private static readonly HashSet<string> MobilePrefixes =
    [
        "3", "70", "71", "76", "78", "79", "81"
    ];

    // Landline area codes (after national 0 / 961)
    private static readonly HashSet<string> LandlineAreaCodes =
    [
        "1", "4", "5", "6", "7", "8", "9"
    ];

    /// <summary>
    /// Returns normalized E.164-ish digits (961…) or empty if unusable.
    /// Accepts: +96176…, 96176…, 076…, 76…, 01…, +9611…
    /// </summary>
    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return string.Empty;

        var trimmed = raw.Trim();
        var hasPlus = trimmed.StartsWith('+');
        var digits = DigitsOnly.Replace(trimmed, "");
        if (digits.Length < 7)
            return string.Empty;

        // Strip leading 00 international prefix
        if (digits.StartsWith("00", StringComparison.Ordinal))
            digits = digits[2..];

        // Already has country code
        if (digits.StartsWith("961", StringComparison.Ordinal))
            return NormalizeNational(digits[3..], assumeMobileIfAmbiguous: true);

        // National format with leading 0
        if (digits.StartsWith('0') && digits.Length >= 8)
            return NormalizeNational(digits[1..], assumeMobileIfAmbiguous: true);

        // Local without 0 (7–8 digits typical)
        if (digits.Length is >= 7 and <= 8)
            return NormalizeNational(digits, assumeMobileIfAmbiguous: true);

        // Fallback: if user typed + and something else, keep as-is when long enough
        if (hasPlus && digits.Length >= 10)
            return digits;

        return string.Empty;
    }

    private static string NormalizeNational(string national, bool assumeMobileIfAmbiguous)
    {
        if (string.IsNullOrEmpty(national))
            return string.Empty;

        // Mobile: 3 + 6 digits, or 70/71/… + 6 digits
        foreach (var prefix in MobilePrefixes.OrderByDescending(p => p.Length))
        {
            if (!national.StartsWith(prefix, StringComparison.Ordinal))
                continue;
            var rest = national[prefix.Length..];
            // Lebanese mobiles are typically 8 national digits total (incl. prefix)
            if (rest.Length is >= 5 and <= 7 && rest.All(char.IsDigit))
                return "961" + prefix + rest;
        }

        // Landline: area code 1 digit + subscriber
        foreach (var area in LandlineAreaCodes)
        {
            if (!national.StartsWith(area, StringComparison.Ordinal))
                continue;
            // Avoid treating mobile 7x as landline 7 when longer mobile match already failed
            if (area == "7" && national.Length >= 2 && national[1] is >= '0' and <= '9')
            {
                var two = national[..2];
                if (MobilePrefixes.Contains(two))
                    continue;
            }
            var rest = national[area.Length..];
            if (rest.Length is >= 6 and <= 7 && rest.All(char.IsDigit))
                return "961" + area + rest;
        }

        if (assumeMobileIfAmbiguous && national.Length is >= 7 and <= 8 && national.All(char.IsDigit))
            return "961" + national;

        return string.Empty;
    }

    /// <summary>True if two raw phones normalize to the same key.</summary>
    public static bool Matches(string? a, string? b)
    {
        var na = Normalize(a);
        var nb = Normalize(b);
        return na.Length > 0 && na == nb;
    }
}
