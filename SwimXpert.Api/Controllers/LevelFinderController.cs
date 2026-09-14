using Microsoft.AspNetCore.Mvc;

namespace SwimXpert.Api.Controllers;

/// <summary>
/// Public level assessment: maps age + 13 yes/no answers to SwimXpert levels 1–6
/// using the same thresholds as the frontend SwimLevelsService (no AI).
/// </summary>
[ApiController]
[Route("api/level-finder")]
public class LevelFinderController : ControllerBase
{
    // Ordered to match the Level Finder form (q1–q13).
    private static readonly string[] QuestionKeys =
    [
        "float",           // q1  → L2
        "kick",            // q2  → L2
        "5–10",            // q3  → L3 (also matches "5-10")
        "roll",            // q4  → L3
        "10–15",           // q5  → L4
        "freestyle",       // q6  → L4/L5 breathing
        "backstroke",      // q7  → L4/L5
        "breaststroke",    // q8  → L4/L5
        "25",              // q9  → L5
        "tread",           // q10 → L6 endurance
        "jump",            // q11 → water confidence
        "flip",            // q12 → L6 turns (also "push-off")
        "butterfly"        // q13 → L6
    ];

    private static readonly (int Level, string Title, string Goal, string[] Focus)[] Catalog =
    [
        (1, "Early Swim Lessons",
            "Build water comfort and confidence",
            ["Water adaptation", "Blowing bubbles / putting face in water", "Assisted floating", "Moving a short distance with support"]),
        (2, "Beginner Swim Lessons",
            "Develop independent buoyancy and simple movement",
            ["Independent floating", "Controlled kicking on front/back", "Submerging face with breath control"]),
        (3, "Beginner-Intermediate Swim Lessons",
            "Begin independent swimming with coordination",
            ["Freestyle kick + body position", "Backstroke kick", "Rolling and returning to wall"]),
        (4, "Intermediate Swim Lessons",
            "Build coordinated strokes and stamina",
            ["Rhythmic freestyle with breathing", "Backstroke with arm movement", "Intro breaststroke", "Treading water (~20–30 sec)"]),
        (5, "Advanced Swim Lessons",
            "Refine strokes and increase endurance",
            ["Freestyle with side breathing", "Backstroke proficiency", "Breaststroke technique", "Start / turn basics"]),
        (6, "Advanced Swim Lessons for Older Kids",
            "Master strokes & prepare for competitive or strong recreational swimming",
            ["Advanced freestyle / backstroke / breaststroke / butterfly", "Efficient starts, turns, wall push-offs", "Treading water (45+ sec)", "Swim multiple lengths comfortably"])
    ];

    /// <summary>
    /// Deterministic placement from age + quiz answers. No auth required.
    /// </summary>
    [HttpPost("analyze")]
    public IActionResult Analyze([FromBody] LevelFinderRequest request)
    {
        if (request.Answers is null || request.Answers.Count == 0)
            return BadRequest(new { message = "Answers are required." });

        if (request.Age < 3 || request.Age > 18)
            return BadRequest(new { message = "Age must be between 3 and 18." });

        var yes = ParseYesFlags(request.Answers);
        var levelNumber = PlaceLevel(request.Age, yes);
        var entry = Catalog[levelNumber - 1];

        var explanation = BuildExplanation(request.Age, levelNumber, entry.Title, entry.Goal, yes);
        var recommendations = entry.Focus.Take(2).ToList();

        // `level` kept for display; `levelNumber` is authoritative for 1–6 UI.
        return Ok(new
        {
            level = ShortBand(levelNumber),
            levelNumber,
            title = entry.Title,
            explanation,
            recommendations
        });
    }

    /// <summary>
    /// Highest level whose SwimLevelsService-style gates are all met.
    /// Age 3 is always Early (L1).
    /// </summary>
    internal static int PlaceLevel(int age, bool[] yes)
    {
        // yes[0]=q1 … yes[12]=q13
        bool Q(int n) => n >= 1 && n <= yes.Length && yes[n - 1];

        if (age <= 3)
            return 1;

        var level = 1;

        // L2: float + kick
        if (Q(1) && Q(2))
            level = 2;

        // L3: + 5–10m + roll
        if (level >= 2 && Q(3) && Q(4))
            level = 3;

        // L4: + 10–15m continuous / breath coordination
        if (level >= 3 && Q(5))
            level = 4;

        // L5: + 25m+ and controlled stroke breathing (freestyle side breathing)
        if (level >= 4 && Q(9) && Q(6))
            level = 5;

        // L6: + multi-stroke / turns / butterfly (older-kid advanced)
        if (level >= 5 && age >= 8 && Q(10) && (Q(12) || Q(13)) && (Q(7) || Q(8)))
            level = 6;

        return level;
    }

    private static bool[] ParseYesFlags(List<LevelFinderAnswer> answers)
    {
        var flags = new bool[13];
        for (var i = 0; i < 13; i++)
        {
            LevelFinderAnswer? match = null;
            if (i < answers.Count)
                match = answers[i];

            // Prefer order; fall back to keyword match if order drifts.
            if (match is null || string.IsNullOrWhiteSpace(match.Question))
            {
                var key = QuestionKeys[i];
                match = answers.FirstOrDefault(a =>
                    (a.Question ?? "").Contains(key, StringComparison.OrdinalIgnoreCase)
                    || (key == "5–10" && (a.Question ?? "").Contains("5-10", StringComparison.OrdinalIgnoreCase))
                    || (key == "10–15" && (a.Question ?? "").Contains("10-15", StringComparison.OrdinalIgnoreCase))
                    || (key == "flip" && (a.Question ?? "").Contains("push-off", StringComparison.OrdinalIgnoreCase)));
            }

            flags[i] = IsYes(match?.Answer);
        }
        return flags;
    }

    private static bool IsYes(string? answer) =>
        string.Equals(answer?.Trim(), "Yes", StringComparison.OrdinalIgnoreCase)
        || string.Equals(answer?.Trim(), "true", StringComparison.OrdinalIgnoreCase);

    private static string ShortBand(int level) => level switch
    {
        1 => "Early",
        2 => "Beginner",
        3 => "Beginner-Intermediate",
        4 => "Intermediate",
        5 => "Advanced",
        6 => "Elite",
        _ => "Early"
    };

    private static string BuildExplanation(int age, int level, string title, string goal, bool[] yes)
    {
        var yesCount = yes.Count(y => y);
        return level switch
        {
            1 when age <= 3 =>
                $"At age {age}, Early Swim Lessons are the right starting point — building water comfort and confidence before independent skills.",
            1 =>
                $"Based on {yesCount} yes answer(s), we recommend {title}. Focus on {goal.ToLowerInvariant()} before moving to independent floating and kicking.",
            _ =>
                $"Based on the skills marked yes ({yesCount} of 13), {title} fits best. Goal: {goal.ToLowerInvariant()}."
        };
    }
}

public class LevelFinderRequest
{
    public int Age { get; set; }
    public List<LevelFinderAnswer> Answers { get; set; } = new();
}

public class LevelFinderAnswer
{
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
}
