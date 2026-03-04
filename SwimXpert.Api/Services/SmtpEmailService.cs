using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace SwimXpert.Api.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration config, ILogger<SmtpEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendVerificationEmailAsync(string toEmail, string userName, string verificationToken, CancellationToken ct = default)
    {
        var baseUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? _config["App:BaseUrl"] ?? "https://localhost:4200";
        var link = $"{baseUrl.TrimEnd('/')}/verify-email?token={Uri.EscapeDataString(verificationToken)}";
        var subject = "Verify your SwimXpert email";
        var body = $@"
<html><body>
<p>Hi {userName},</p>
<p>Please verify your email by clicking the link below:</p>
<p><a href=""{link}"">{link}</a></p>
<p>This link expires in 24 hours.</p>
<p>If you didn't create an account, you can ignore this email.</p>
</body></html>";
        await SendAsync(toEmail, subject, body, ct);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetToken, CancellationToken ct = default)
    {
        var baseUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? _config["App:BaseUrl"] ?? "https://localhost:4200";
        var link = $"{baseUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(resetToken)}";
        var subject = "Reset your SwimXpert password";
        var body = $@"
<html><body>
<p>Hi {userName},</p>
<p>Click the link below to reset your password:</p>
<p><a href=""{link}"">{link}</a></p>
<p>This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
</body></html>";
        await SendAsync(toEmail, subject, body, ct);
    }

    private async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct)
    {
        var host = Environment.GetEnvironmentVariable("SMTP_HOST") ?? _config["Smtp:Host"];
        var port = int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? _config["Smtp:Port"] ?? "587");
        var user = Environment.GetEnvironmentVariable("SMTP_USER") ?? _config["Smtp:User"];
        var pass = Environment.GetEnvironmentVariable("SMTP_PASS") ?? _config["Smtp:Pass"];
        var from = Environment.GetEnvironmentVariable("SMTP_FROM") ?? _config["Smtp:From"];
        if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(from))
        {
            _logger.LogWarning("SMTP not configured; skipping send to {To}", to);
            return;
        }
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart(MimeKit.Text.TextFormat.Html) { Text = htmlBody };
        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTlsWhenAvailable, ct);
        if (!string.IsNullOrEmpty(user) && !string.IsNullOrEmpty(pass))
            await client.AuthenticateAsync(user, pass, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
