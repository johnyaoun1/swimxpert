using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class Payment
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    [Range(0.01, 1000000)]
    public decimal Amount { get; set; }

    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

    [MaxLength(30)]
    public string Method { get; set; } = "Cash";

    [MaxLength(30)]
    public string Status { get; set; } = "Completed"; // Completed | Pending | Failed

    [MaxLength(100)]
    public string? Reference { get; set; }
}
