using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class Payment
{
    public int Id { get; set; }

    /// <summary>Optional after the user row is removed (e.g. rejected signup); payment row kept for audit.</summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>Optional link to a booking (e.g. legacy online holds). Manual payments usually leave this null.</summary>
    public int? AttendanceId { get; set; }
    public Attendance? Attendance { get; set; }

    [Range(0.01, 1000000)]
    public decimal Amount { get; set; }

    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

    [MaxLength(30)]
    public string Method { get; set; } = "Cash";

    [MaxLength(30)]
    public string Status { get; set; } = "Completed"; // Completed | Pending | Failed | Refunded

    [MaxLength(100)]
    public string? Reference { get; set; }
}
