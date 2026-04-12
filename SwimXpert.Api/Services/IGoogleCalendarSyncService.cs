namespace SwimXpert.Api.Services;

public interface IGoogleCalendarSyncService
{
    Task<GoogleCalendarSyncResult> SyncAsync(CancellationToken cancellationToken = default);
}

public sealed class GoogleCalendarSyncResult
{
    public int Created { get; init; }
    public int Updated { get; init; }
    public int Skipped { get; init; }
    public int CancelledInDb { get; init; }
    public List<string> Errors { get; init; } = [];
}
