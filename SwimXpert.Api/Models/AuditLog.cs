using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class AuditLog
{
    public int Id { get; set; }
    public int AdminUserId { get; set; }
    [MaxLength(255)]
    public string AdminEmail { get; set; } = string.Empty;
    [MaxLength(100)]
    public string Action { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? TargetType { get; set; }
    [MaxLength(50)]
    public string? TargetId { get; set; }
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    [MaxLength(45)]
    public string? IpAddress { get; set; }
}
