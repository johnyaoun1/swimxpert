namespace SwimXpert.Api.Models;

public class QuizResult
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int Score { get; set; }
    public int TotalQuestions { get; set; }
    public int Percentage { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
