namespace SwimXpert.Api.Services;

/// <summary>
/// Whether the Data Protection certificate loaded. Google Calendar stays off until it does.
/// </summary>
public sealed class CalendarEncryptionStatus
{
    public const string DisabledMessage = "Calendar sync disabled: encryption certificate missing.";

    public bool Ready { get; init; }

    /// <summary>Startup log only. Never returned to the browser. Contains no secrets.</summary>
    public string? LoadError { get; init; }
}
