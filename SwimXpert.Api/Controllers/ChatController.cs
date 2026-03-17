using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;

    public ChatController(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "Message is required." });

        var apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(503, new { error = "GEMINI_API_KEY is not set." });

        const string systemPrompt = """
You are SwimXpert's assistant. SwimXpert is a swimming school in Lebanon.
Help users choose a swimming level, explain programs, and guide them to book a trial session.
If asked about pricing, ask them to contact SwimXpert for current rates.
Answer in the same language as the user (Arabic or English). Keep replies short.
""";

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = request.Message } } }
            },
            generationConfig = new { temperature = 0.7, maxOutputTokens = 300 }
        };

        var json = JsonSerializer.Serialize(body);
var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

        var client = _httpClientFactory.CreateClient();
        var resp = await client.PostAsync(url, new StringContent(json, Encoding.UTF8, "application/json"));
        var respText = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
            return StatusCode(502, new { error = "Gemini error", details = respText });

        using var doc = JsonDocument.Parse(respText);
        var reply =
            doc.RootElement.GetProperty("candidates")[0]
               .GetProperty("content").GetProperty("parts")[0]
               .GetProperty("text").GetString();

        return Ok(new { reply = reply ?? "" });
    }
}

public record ChatRequest(string Message);