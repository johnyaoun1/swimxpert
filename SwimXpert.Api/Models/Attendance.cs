namespace SwimXpert.Api.Models;

public class Attendance
{
    public int Id { get; set; }

    public int SwimmerId { get; set; }
    public Swimmer Swimmer { get; set; } = null!;

    public int TrainingSessionId { get; set; }
    public TrainingSession TrainingSession { get; set; } = null!;

    public DateTime SessionDate { get; set; }
    public bool IsPresent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
