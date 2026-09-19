namespace SwimXpert.Api.Models;

/// <summary>
/// Booking / attendance row. SwimmerId is the booking subject (child OR account-holder profile).
/// FLAG(Booking=Child): historically assumed a parent's child; IsAccountHolder profiles are valid too.
/// </summary>
public class Attendance
{
    public int Id { get; set; }

    public int SwimmerId { get; set; }
    public Swimmer Swimmer { get; set; } = null!;

    public int TrainingSessionId { get; set; }
    public TrainingSession TrainingSession { get; set; } = null!;
    
    public DateTime SessionDate { get; set; }
    public bool IsPresent { get; set; }
    /// <summary>Pending | Confirmed | Rejected</summary>
    public string BookingStatus { get; set; } = "Confirmed";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
