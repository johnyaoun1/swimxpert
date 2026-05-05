namespace SwimXpert.Api.Services;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string userName, string verificationToken, CancellationToken ct = default);
    Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetToken, CancellationToken ct = default);
    Task SendWelcomeEmailAsync(string toEmail, string fullName, string username, string password, CancellationToken ct = default);
}
