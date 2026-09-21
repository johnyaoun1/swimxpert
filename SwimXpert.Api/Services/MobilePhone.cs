using PhoneNumbers;

namespace SwimXpert.Api.Services;

/// <summary>
/// Parses a signup phone into E.164 and accepts mobile numbers only.
/// </summary>
public static class MobilePhone
{
    public static (bool Ok, string? E164, string? Error) TryNormalize(string? raw, string? region)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return (false, null, "Phone number is required.");

        var regionCode = string.IsNullOrWhiteSpace(region) ? "LB" : region.Trim().ToUpperInvariant();
        if (regionCode.Length != 2 || !regionCode.All(char.IsLetter))
            return (false, null, "Choose a valid country code.");

        var util = PhoneNumberUtil.GetInstance();
        PhoneNumber number;
        try
        {
            number = util.Parse(raw.Trim(), regionCode);
        }
        catch (NumberParseException)
        {
            return (false, null, "Enter a valid mobile number.");
        }

        if (!util.IsValidNumber(number))
            return (false, null, "Enter a valid mobile number.");

        var type = util.GetNumberType(number);
        if (type is not PhoneNumberType.MOBILE and not PhoneNumberType.FIXED_LINE_OR_MOBILE)
            return (false, null, "Enter a mobile number. Landlines are not accepted.");

        var e164 = util.Format(number, PhoneNumberFormat.E164);
        return (true, e164, null);
    }
}
