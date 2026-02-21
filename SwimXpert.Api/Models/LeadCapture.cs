using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class LeadCapture
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(200)]
    public string? SourcePage { get; set; }

    [MaxLength(200)]
    public string? SourceAction { get; set; }

    [MaxLength(400)]
    public string? UserAgent { get; set; }

    public bool IsContacted { get; set; } = false;
    public DateTime? ContactedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
