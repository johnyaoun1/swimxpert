using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

/// <summary>
/// New = first-time online registrant.
/// Returning = phone matched a legacy/offline client record at signup.
/// </summary>
public static class ClientStatuses
{
    public const string New = "New";
    public const string Returning = "Returning";
}

/// <summary>
/// Swimmer profile owned by a parent account. Can represent a child or the account holder
/// themselves (IsAccountHolder). This is the booking subject (Attendance.SwimmerId).
/// Table remains "Swimmers" for backward compatibility.
/// </summary>
public class Swimmer
{
    public int Id { get; set; }

    public int ParentUserId { get; set; }
    public User ParentUser { get; set; } = null!;

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 100)]
    public int Age { get; set; }

    [Range(1, 10)]
    public int Level { get; set; } = 1;

    /// <summary>True when this profile is the account holder (adult swimming for themselves).</summary>
    public bool IsAccountHolder { get; set; }

    [MaxLength(500)]
    public string? ProfilePictureUrl { get; set; }

    public string SkillProgressJson { get; set; } = "{}";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Attendance> Attendances { get; set; } = [];
    public List<ProgressEntry> ProgressEntries { get; set; } = [];
}

/// <summary>
/// Offline / pre-app clients used to detect Returning status by normalized phone.
/// Seed via CSV at deploy/legacy-clients.csv (Phone,Name) or admin import later.
/// </summary>
public class LegacyClient
{
    public int Id { get; set; }

    [Required]
    [MaxLength(32)]
    public string PhoneNormalized { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? DisplayName { get; set; }

    [MaxLength(64)]
    public string? Source { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
