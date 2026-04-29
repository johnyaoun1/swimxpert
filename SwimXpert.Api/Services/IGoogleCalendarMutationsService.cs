using SwimXpert.Api.Models;

namespace SwimXpert.Api.Services;

/// <summary>Delete or update events on Google Calendar (requires calendar.events scope).</summary>
public interface IGoogleCalendarMutationsService
{
    /// <summary>Deletes the event on Google if <paramref name="googleEventId"/> is set. Ignores 404.</summary>
    Task<(bool Ok, string? Error)> TryDeleteGoogleEventAsync(string? googleEventId, CancellationToken ct = default);

    /// <summary>Pushes title, time range, and price to Google for synced sessions.</summary>
    Task<(bool Ok, string? Error)> TryPushSessionToGoogleAsync(TrainingSession session, CancellationToken ct = default);
}
