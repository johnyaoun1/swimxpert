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

    public async Task SendWelcomeEmailAsync(string toEmail, string fullName, string username, string password, CancellationToken ct = default)
    {
        var baseUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? _config["App:BaseUrl"] ?? "https://localhost:4200";
        var loginLink = $"{baseUrl.TrimEnd('/')}/login";
        var subject = "Welcome to SwimXpert \u2014 Your Account Details";
        var body = $@"
<html>
<body style=""margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f0f4f8;padding:40px 0;"">
    <tr>
      <td align=""center"">
        <table width=""560"" cellpadding=""0"" cellspacing=""0"" style=""background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"">
          <!-- Header -->
          <tr>
            <td style=""background:linear-gradient(135deg,#0d1b3e,#1890ff);padding:36px 40px;text-align:center;"">
              <h1 style=""margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;"">SwimXpert</h1>
              <p style=""margin:8px 0 0;color:#bfdbfe;font-size:14px;"">Your swimming journey starts here</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style=""padding:40px;"">
              <p style=""margin:0 0 16px;font-size:16px;color:#1e293b;"">Hi <strong>{fullName}</strong>,</p>
              <p style=""margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;"">
                Your SwimXpert account has been created. Use the credentials below to log in and get started.
              </p>
              <!-- Credentials box -->
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;"">
                <tr>
                  <td style=""padding:24px 28px;"">
                    <table width=""100%"">
                      <tr>
                        <td style=""padding:8px 0;border-bottom:1px solid #e2e8f0;"">
                          <span style=""font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;"">Username</span><br>
                          <span style=""font-size:18px;font-weight:700;color:#0d1b3e;font-family:monospace;letter-spacing:0.04em;"">{username}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style=""padding:12px 0 8px;"">
                          <span style=""font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;"">Password</span><br>
                          <span style=""font-size:18px;font-weight:700;color:#0d1b3e;font-family:monospace;letter-spacing:0.04em;"">{password}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style=""margin:0 0 8px;font-size:13px;color:#94a3b8;"">Your login email is: <strong style=""color:#475569;"">{toEmail}</strong></p>
              <p style=""margin:0 0 28px;font-size:13px;color:#f59e0b;"">&#9888;&#65039; Please change your password after your first login.</p>
              <a href=""{loginLink}"" style=""display:inline-block;background:linear-gradient(135deg,#1890ff,#0ea5e9);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;"">Log In to SwimXpert &rarr;</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;"">
              <p style=""margin:0;font-size:12px;color:#94a3b8;"">If you have any questions, reply to this email or contact your coach.</p>
              <p style=""margin:8px 0 0;font-size:12px;color:#cbd5e1;"">&copy; {DateTime.UtcNow.Year} SwimXpert. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
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
