using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public ChatController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Message is required." });

        // Read from user-secrets / appsettings first, fall back to OS env var
        var apiKey = _configuration["GEMINI_API_KEY"]
                  ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(503, new { message = "AI service is not configured. Please contact support." });

        const string systemPrompt = """
You are SwimXpert's AI assistant. SwimXpert is a professional swimming school in Lebanon (Beirut).
Help users choose a swimming level, explain programs, and guide them to book a session.
If asked about pricing, ask them to contact SwimXpert for current rates.
Answer in the same language as the user (Arabic or English). Keep replies concise and friendly.
""";

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = request.Message } } }
            },
            generationConfig = new
            {
                temperature = 0.7,
                maxOutputTokens = 400,
                thinkingConfig = new { thinkingBudget = 0 }
            }
        };

        var json = JsonSerializer.Serialize(body);
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

        var client = _httpClientFactory.CreateClient();
        var resp = await client.PostAsync(url, new StringContent(json, Encoding.UTF8, "application/json"));
        var respText = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
            return StatusCode(502, new { message = "AI service is temporarily unavailable. Please try again." });

        using var doc = JsonDocument.Parse(respText);
        var parts = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")
            .EnumerateArray()
            .ToList();

        // Skip thought parts (gemini-2.5-flash returns thought + answer parts)
        var answerPart = parts.LastOrDefault(p =>
            !p.TryGetProperty("thought", out var t) || !t.GetBoolean());

        var reply = answerPart.ValueKind != JsonValueKind.Undefined
            ? answerPart.GetProperty("text").GetString() ?? ""
            : "";

        return Ok(new { reply });
    }
}

public record ChatRequest(string Message);
