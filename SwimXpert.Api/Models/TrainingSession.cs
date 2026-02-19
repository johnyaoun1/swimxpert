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

    [MaxLength(30)]
    public string Status { get; set; } = "Scheduled"; // Scheduled | Completed | Cancelled

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Attendance> Attendances { get; set; } = [];
}
