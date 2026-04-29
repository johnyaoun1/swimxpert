namespace SwimXpert.Api.Models;

/// <summary>Singleton row (Id=1): org-wide Google refresh token for calendar sync.</summary>
public class GoogleCalendarState
{
    public int Id { get; set; } = 1;
    public string? RefreshToken { get; set; }
    public DateTime? LastSyncUtc { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
