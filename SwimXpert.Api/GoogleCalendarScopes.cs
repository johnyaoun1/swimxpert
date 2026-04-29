namespace SwimXpert.Api;

public static class GoogleCalendarScopes
{
    /// <summary>Read/write events (required for sync, delete from app, push price). Re-authorize Google after changing from readonly.</summary>
    public static readonly string[] Values =
    [
        "https://www.googleapis.com/auth/calendar.events"
    ];
}
