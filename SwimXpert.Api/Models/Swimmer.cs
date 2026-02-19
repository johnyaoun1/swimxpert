using System.ComponentModel.DataAnnotations;

namespace SwimXpert.Api.Models;

public class Swimmer
{
    public int Id { get; set; }

    public int ParentUserId { get; set; }
    public User ParentUser { get; set; } = null!;

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 30)]
    public int Age { get; set; }

    [Range(1, 10)]
    public int Level { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Attendance> Attendances { get; set; } = [];
}
