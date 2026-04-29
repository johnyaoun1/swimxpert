using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class TrainingSession
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    public int Capacity { get; set; } = 10;

    [MaxLength(200)]
    public string? PoolLocation { get; set; }

    [MaxLength(30)]
    public string Status { get; set; } = "Scheduled"; // Scheduled | Completed | Cancelled

    /// <summary>Session fee set by admin (brief income uses this when IsPaid is true).</summary>
    public decimal Price { get; set; }

    /// <summary>Marked when this session fee counts toward weekly brief income.</summary>
    public bool IsPaid { get; set; }

    /// <summary>Set when this row was created or matched from Google Calendar; used for import/sync.</summary>
    [MaxLength(200)]
    public string? GoogleEventId { get; set; }

    /// <summary>Links weekly package sessions (same client/time pattern). Null = one-off session.</summary>
    public Guid? RecurrenceSeriesId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Attendance> Attendances { get; set; } = [];
}
