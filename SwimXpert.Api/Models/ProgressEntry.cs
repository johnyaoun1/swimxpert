using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class ProgressEntry
{
    public int Id { get; set; }

    public int SwimmerId { get; set; }
    public Swimmer Swimmer { get; set; } = null!;

    public DateTime EntryDate { get; set; }

    [Range(1, 6)]
    public int Level { get; set; }

    [MaxLength(1000)]
    public string Notes { get; set; } = string.Empty;

    /// <summary>JSON array of skill names, e.g. ["Freestyle kick", "Backstroke"]</summary>
    public string SkillsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
