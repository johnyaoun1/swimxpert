namespace SwimXpert.Api.Options;

/// <summary>
/// Google OAuth + Calendar sync. Set ClientId/ClientSecret/CalendarId from Google Cloud Console.
/// </summary>
public class GoogleCalendarOptions
{
    public const string SectionName = "GoogleCalendar";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>Public base URL of this API (no trailing slash), e.g. https://api.example.com or http://localhost:5002</summary>
    public string PublicApiBaseUrl { get; set; } = "http://localhost:5002";

    /// <summary>Where to send the browser after OAuth succeeds (Angular origin + path).</summary>
    public string FrontendRedirectBaseUrl { get; set; } = "http://localhost:4200";

    /// <summary>The calendar resource id (same as embed src=...), e.g. abc...@group.calendar.google.com</summary>
    public string CalendarId { get; set; } = string.Empty;

    public int SyncDaysPast { get; set; } = 14;
    public int SyncDaysFuture { get; set; } = 120;
}
