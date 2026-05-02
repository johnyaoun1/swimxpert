using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/level-finder")]
public class LevelFinderController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public LevelFinderController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    /// <summary>
    /// Sends the 13 quiz answers to Gemini and returns an AI-powered level assessment.
    /// No auth required — the level finder is publicly accessible.
    /// </summary>
    [HttpPost("analyze")]
    public async Task<IActionResult> Analyze([FromBody] LevelFinderRequest request)
    {
        if (request.Answers is null || request.Answers.Count == 0)
            return BadRequest(new { message = "Answers are required." });

        // Read from user-secrets / appsettings first, fall back to OS env var
        var apiKey = _configuration["GEMINI_API_KEY"]
                  ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(503, new { message = "Gemini API key is not configured. Please contact support." });

        const string systemPrompt = """
You are a professional swimming coach and assessor. Based on the following
swimmer self-assessment answers, determine their swimming level
(Beginner, Intermediate, Advanced, or Elite), explain why in 2-3 sentences,
and give exactly 2 specific recommendations for what they should focus on in training.
Be encouraging and professional.

You MUST respond with valid JSON only, using this exact structure:
{
  "level": "Beginner",
  "explanation": "...",
  "recommendations": ["...", "..."]
}
The "level" field must be one of: Beginner, Intermediate, Advanced, Elite.
""";

        var answersBlock = string.Join("\n", request.Answers.Select(a =>
            $"  - {a.Question}: {a.Answer}"));

        var userMessage = $"Child's age: {request.Age} years old\n\nAssessment answers:\n{answersBlock}";

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = userMessage } } }
            },
            generationConfig = new
            {
                temperature = 0.4,
                maxOutputTokens = 512,
                responseMimeType = "application/json",
                thinkingConfig = new { thinkingBudget = 0 }
            }
        };

        var json = JsonSerializer.Serialize(body);
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

        var client = _httpClientFactory.CreateClient();
        var resp = await client.PostAsync(url, new StringContent(json, Encoding.UTF8, "application/json"));
        var respText = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
            return StatusCode(502, new { message = $"Gemini error {(int)resp.StatusCode}: {respText}" });

        using var doc = JsonDocument.Parse(respText);
        var parts = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")
            .EnumerateArray()
            .ToList();

        // Skip thought parts (gemini-2.5-flash thinking model returns thought + answer parts)
        var answerPart = parts.LastOrDefault(p =>
            !p.TryGetProperty("thought", out var t) || !t.GetBoolean());

        var rawJson = answerPart.ValueKind != JsonValueKind.Undefined
            ? answerPart.GetProperty("text").GetString()
            : null;

        if (string.IsNullOrWhiteSpace(rawJson))
            return StatusCode(502, new { message = "AI returned an empty response. Please try again." });

        using var resultDoc = JsonDocument.Parse(rawJson!);
        var root = resultDoc.RootElement;

        var level          = root.TryGetProperty("level",           out var lv)  ? lv.GetString()  ?? "Beginner" : "Beginner";
        var explanation    = root.TryGetProperty("explanation",     out var ex)  ? ex.GetString()  ?? ""         : "";
        var recommendations = root.TryGetProperty("recommendations", out var rec)
            ? rec.EnumerateArray().Select(r => r.GetString() ?? "").ToList()
            : new List<string>();

        return Ok(new { level, explanation, recommendations });
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
    public string Answer   { get; set; } = string.Empty;
}
