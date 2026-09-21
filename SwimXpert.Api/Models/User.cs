using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SwimXpert.Api.Models;

public class User
{
    public int Id { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Username { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "Parent";

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Self-registered parents start false and cannot book until an admin approves them.
    /// Dashboard login is allowed. Admin-created accounts are set true.
    /// </summary>
    public bool IsApproved { get; set; } = true;

    /// <summary>New | Returning — set at signup via legacy phone match.</summary>
    [MaxLength(20)]
    public string ClientStatus { get; set; } = ClientStatuses.New;

    public bool EmailVerified { get; set; }
    [MaxLength(64)]
    public string? EmailVerificationTokenHash { get; set; }
    public DateTime? EmailVerificationTokenExpiry { get; set; }

    public int FailedLoginAttempts { get; set; }
    public DateTime? LockoutUntil { get; set; }

    [MaxLength(64)]
    public string? PasswordResetTokenHash { get; set; }
    public DateTime? PasswordResetTokenExpiry { get; set; }

    /// <summary>
    /// Set when an admin issues a temporary password. The account cannot use the API
    /// until they choose a new password.
    /// </summary>
    public bool MustChangePassword { get; set; }

    /// <summary>
    /// Incremented to invalidate outstanding access tokens. The JWT carries the same value.
    /// </summary>
    public int TokenVersion { get; set; }

    public bool TwoFactorEnabled { get; set; }
    [MaxLength(256)]
    public string? TwoFactorSecret { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Swimmer> Swimmers { get; set; } = [];

    [JsonIgnore]
    public List<Payment> Payments { get; set; } = [];
    public List<QuizResult> QuizResults { get; set; } = [];
}
