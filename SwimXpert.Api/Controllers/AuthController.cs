using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OtpNet;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(ApplicationDbContext dbContext, IConfiguration configuration, ILogger<AuthController> logger, SwimXpert.Api.Services.IEmailService emailService) : ControllerBase
{
    private const int BcryptWorkFactor = 12;
    private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var (valid, message) = ValidateRegisterRequest(request);
        if (!valid)
            return BadRequest(new { message });

        var email = request.Email!.Trim().ToLowerInvariant();
        var exists = await dbContext.Users.AnyAsync(u => u.Email == email);
        if (exists)
            return Conflict(new { message = "Email already exists." });

        var fullName = SanitizeFullName(request.FullName!);
        if (string.IsNullOrWhiteSpace(fullName))
            return BadRequest(new { message = "Full name is required." });

        var verificationToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var verificationHash = HashToken(verificationToken);

        var user = new User
        {
            Email = email,
            Password = BCrypt.Net.BCrypt.HashPassword(request.Password!, BcryptWorkFactor),
            FullName = fullName,
            Role = "Parent",
            CreatedAt = DateTime.UtcNow,
            EmailVerified = false,
            EmailVerificationTokenHash = verificationHash,
            EmailVerificationTokenExpiry = DateTime.UtcNow.AddHours(24)
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        await emailService.SendVerificationEmailAsync(user.Email, user.FullName, verificationToken);

        var accessToken = GenerateJwtToken(user);
        var (refreshToken, _) = await CreateRefreshTokenAsync(user.Id);
        SetAccessTokenCookie(accessToken);
        SetRefreshTokenCookie(refreshToken);
        return Ok(new AuthResponse(user.Id, user.Email, user.FullName, user.Role));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return Unauthorized(new { message = "Invalid email or password." });

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
        {
            logger.LogWarning("Failed login attempt from {RemoteIp} at {Time}", HttpContext.Connection.RemoteIpAddress, DateTime.UtcNow);
            return Unauthorized(new { message = "Invalid email or password." });
        }
        if (user.LockoutUntil.HasValue && user.LockoutUntil.Value > DateTime.UtcNow)
        {
            var secondsRemaining = (int)(user.LockoutUntil.Value - DateTime.UtcNow).TotalSeconds;
            return StatusCode(423, new { message = "Account locked due to too many failed attempts.", secondsRemaining });
        }
        if (!user.IsActive || !BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockoutUntil = DateTime.UtcNow.AddMinutes(15);
                user.FailedLoginAttempts = 0;
                logger.LogWarning("Account lockout for {Email} from {RemoteIp} at {Time}", user.Email, HttpContext.Connection.RemoteIpAddress, DateTime.UtcNow);
            }
            await dbContext.SaveChangesAsync();
            logger.LogWarning("Failed login attempt from {RemoteIp} at {Time}", HttpContext.Connection.RemoteIpAddress, DateTime.UtcNow);
            return Unauthorized(new { message = "Invalid email or password." });
        }
        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;
        await dbContext.SaveChangesAsync();
        if (!user.EmailVerified)
            return StatusCode(403, new { message = "Please verify your email.", code = "email_not_verified" });
        if (user.TwoFactorEnabled)
            return StatusCode(202, new { message = "2FA required.", code = "2fa_required", email = user.Email });

        var accessToken = GenerateJwtToken(user);
        var (refreshToken, _) = await CreateRefreshTokenAsync(user.Id);
        SetAccessTokenCookie(accessToken);
        SetRefreshTokenCookie(refreshToken);
        return Ok(new AuthResponse(user.Id, user.Email, user.FullName, user.Role));
    }

    [HttpPost("2fa/verify")]
    public async Task<IActionResult> Verify2Fa([FromBody] Verify2FaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { message = "Email and code are required." });
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == request.Email.Trim().ToLowerInvariant());
        if (user is null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
            return Unauthorized(new { message = "Invalid request." });
        var totp = new Totp(Base32Encoding.ToBytes(user.TwoFactorSecret));
        if (!totp.VerifyTotp(request.Code.Trim().Replace(" ", ""), out _, new VerificationWindow(1, 1)))
            return Unauthorized(new { message = "Invalid or expired code." });
        var accessToken = GenerateJwtToken(user);
        var (refreshToken, _) = await CreateRefreshTokenAsync(user.Id);
        SetAccessTokenCookie(accessToken);
        SetRefreshTokenCookie(refreshToken);
        return Ok(new AuthResponse(user.Id, user.Email, user.FullName, user.Role));
    }

    [Authorize]
    [HttpPost("2fa/setup")]
    public async Task<IActionResult> Setup2Fa()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var user = await dbContext.Users.FindAsync(userId);
        if (user is null) return Unauthorized();
        var secret = KeyGeneration.GenerateRandomKey(20);
        var base32 = Base32Encoding.ToString(secret);
        user.TwoFactorSecret = base32;
        user.TwoFactorEnabled = false;
        await dbContext.SaveChangesAsync();
        var issuer = configuration["Jwt:Issuer"] ?? "SwimXpert";
        var qrUri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(user.Email)}?secret={base32}&issuer={Uri.EscapeDataString(issuer)}";
        return Ok(new { secret = base32, qrCodeUri = qrUri });
    }

    [Authorize]
    [HttpPost("2fa/enable")]
    public async Task<IActionResult> Enable2Fa([FromBody] Enable2FaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { message = "Code is required." });
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var user = await dbContext.Users.FindAsync(userId);
        if (user is null || string.IsNullOrEmpty(user.TwoFactorSecret))
            return BadRequest(new { message = "Run setup first." });
        var totp = new Totp(Base32Encoding.ToBytes(user.TwoFactorSecret));
        if (!totp.VerifyTotp(request.Code.Trim().Replace(" ", ""), out _, new VerificationWindow(1, 1)))
            return BadRequest(new { message = "Invalid code." });
        user.TwoFactorEnabled = true;
        await dbContext.SaveChangesAsync();
        return Ok(new { message = "2FA enabled." });
    }

    [Authorize]
    [HttpPost("2fa/disable")]
    public async Task<IActionResult> Disable2Fa([FromBody] Disable2FaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { message = "Code is required." });
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var user = await dbContext.Users.FindAsync(userId);
        if (user is null || !user.TwoFactorEnabled)
            return BadRequest(new { message = "2FA is not enabled." });
        var totp = new Totp(Base32Encoding.ToBytes(user.TwoFactorSecret!));
        if (!totp.VerifyTotp(request.Code.Trim().Replace(" ", ""), out _, new VerificationWindow(1, 1)))
            return BadRequest(new { message = "Invalid code." });
        user.TwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        await dbContext.SaveChangesAsync();
        return Ok(new { message = "2FA disabled." });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var refreshValue = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(refreshValue))
            return Unauthorized(new { message = "Refresh token missing." });

        var hash = HashRefreshToken(refreshValue);
        var tokenEntity = await dbContext.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == hash && r.RevokedAt == null && r.ExpiresAt > DateTime.UtcNow);
        if (tokenEntity is null)
            return Unauthorized(new { message = "Invalid or expired refresh token." });

        var user = tokenEntity.User;
        if (!user.IsActive)
            return Unauthorized(new { message = "Account disabled." });

        tokenEntity.RevokedAt = DateTime.UtcNow;
        var (newRefreshValue, newTokenEntity) = await CreateRefreshTokenAsync(user.Id);
        tokenEntity.ReplacedByTokenHash = HashRefreshToken(newRefreshValue);
        await dbContext.SaveChangesAsync();

        var accessToken = GenerateJwtToken(user);
        SetAccessTokenCookie(accessToken);
        SetRefreshTokenCookie(newRefreshValue);
        return Ok(new AuthResponse(user.Id, user.Email, user.FullName, user.Role));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var refreshValue = Request.Cookies["refresh_token"];
        if (!string.IsNullOrEmpty(refreshValue))
        {
            var hash = HashRefreshToken(refreshValue);
            var tokenEntity = await dbContext.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash && r.RevokedAt == null);
            if (tokenEntity != null)
            {
                tokenEntity.RevokedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();
            }
        }
        ClearAccessTokenCookie();
        ClearRefreshTokenCookie();
        return Ok(new { message = "Logged out." });
    }

    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Token is required." });
        var hash = HashToken(token);
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.EmailVerificationTokenHash == hash);
        if (user is null || user.EmailVerificationTokenExpiry < DateTime.UtcNow)
            return BadRequest(new { message = "Invalid or expired verification token." });
        user.EmailVerified = true;
        user.EmailVerificationTokenHash = null;
        user.EmailVerificationTokenExpiry = null;
        await dbContext.SaveChangesAsync();
        return Ok(new { message = "Email verified. You can now log in." });
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
            return Ok(new { message = "If an account exists, a verification email was sent." });
        if (user.EmailVerified)
            return Ok(new { message = "Email is already verified." });
        var verificationToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        user.EmailVerificationTokenHash = HashToken(verificationToken);
        user.EmailVerificationTokenExpiry = DateTime.UtcNow.AddHours(24);
        await dbContext.SaveChangesAsync();
        await emailService.SendVerificationEmailAsync(user.Email, user.FullName, verificationToken);
        return Ok(new { message = "Verification email sent." });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return Ok(new { message = "If an account exists, a reset link was sent." });
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user != null)
        {
            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            user.PasswordResetTokenHash = HashToken(token);
            user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            await dbContext.SaveChangesAsync();
            await emailService.SendPasswordResetEmailAsync(user.Email, user.FullName, token);
        }
        return Ok(new { message = "If an account exists, a reset link was sent." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { message = "Token and new password are required." });
        if (request.NewPassword.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });
        var hash = HashToken(request.Token);
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.PasswordResetTokenHash == hash);
        if (user is null || user.PasswordResetTokenExpiry < DateTime.UtcNow)
            return BadRequest(new { message = "Invalid or expired reset token." });
        user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, BcryptWorkFactor);
        user.PasswordResetTokenHash = null;
        user.PasswordResetTokenExpiry = null;
        var refreshTokens = await dbContext.RefreshTokens.Where(r => r.UserId == user.Id && r.RevokedAt == null).ToListAsync();
        foreach (var rt in refreshTokens)
            rt.RevokedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        return Ok(new { message = "Password reset. You can now log in." });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = User.FindFirstValue(ClaimTypes.Email);
        var fullName = User.FindFirstValue(ClaimTypes.Name);
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrEmpty(id) || !int.TryParse(id, out var userId))
            return Unauthorized(new { message = "Not authenticated." });
        var user = await dbContext.Users.AsNoTracking().Select(u => new { u.Id, u.TwoFactorEnabled }).FirstOrDefaultAsync(u => u.Id == userId);
        return Ok(new
        {
            id = userId,
            email = email ?? "",
            fullName = fullName ?? "",
            role = role ?? "Parent",
            twoFactorEnabled = user?.TwoFactorEnabled ?? false
        });
    }

    private async Task<(string RawToken, RefreshToken Entity)> CreateRefreshTokenAsync(int userId)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var hash = HashRefreshToken(rawToken);
        var entity = new RefreshToken
        {
            UserId = userId,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };
        dbContext.RefreshTokens.Add(entity);
        await dbContext.SaveChangesAsync();
        return (rawToken, entity);
    }

    private static string HashRefreshToken(string raw)
    {
        var bytes = Encoding.UTF8.GetBytes(raw);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static string HashToken(string raw)
    {
        var bytes = Encoding.UTF8.GetBytes(raw);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private void SetAccessTokenCookie(string token)
    {
        var isDev = HttpContext.Request.Host.Host == "localhost" || HttpContext.Request.Host.Host == "127.0.0.1";
        Response.Cookies.Append("access_token", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDev,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddMinutes(
                configuration.GetValue<int>("Jwt:ExpiryInMinutes", 60)),
            Path = "/"
        });
    }

    private void SetRefreshTokenCookie(string rawToken)
    {
        var isDev = HttpContext.Request.Host.Host == "localhost" || HttpContext.Request.Host.Host == "127.0.0.1";
        Response.Cookies.Append("refresh_token", rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDev,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
            Path = "/"
        });
    }

    private void ClearAccessTokenCookie()
    {
        var isDev = HttpContext.Request.Host.Host == "localhost" || HttpContext.Request.Host.Host == "127.0.0.1";
        Response.Cookies.Delete("access_token", new CookieOptions { HttpOnly = true, Secure = !isDev, SameSite = SameSiteMode.Strict, Path = "/" });
    }

    private void ClearRefreshTokenCookie()
    {
        var isDev = HttpContext.Request.Host.Host == "localhost" || HttpContext.Request.Host.Host == "127.0.0.1";
        Response.Cookies.Delete("refresh_token", new CookieOptions { HttpOnly = true, Secure = !isDev, SameSite = SameSiteMode.Strict, Path = "/" });
    }

    private static (bool valid, string? message) ValidateRegisterRequest(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return (false, "Email is required.");
        if (string.IsNullOrWhiteSpace(request.Password))
            return (false, "Password is required.");
        if (string.IsNullOrWhiteSpace(request.FullName))
            return (false, "Full name is required.");
        if (request.Email.Length > 255)
            return (false, "Email is too long.");
        if (request.FullName.Length > 255)
            return (false, "Full name is too long.");
        if (request.Password.Length < 8)
            return (false, "Password must be at least 8 characters.");
        if (request.Password.Length > 128)
            return (false, "Password is too long.");
        if (!EmailRegex.IsMatch(request.Email.Trim()))
            return (false, "Invalid email format.");
        return (true, null);
    }

    private static string SanitizeFullName(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return "";
        var normalized = Regex.Replace(fullName.Trim(), @"\s+", " ");
        return normalized.Length > 255 ? normalized[..255] : normalized;
    }

    [Authorize]
    [HttpGet("validate-token")]
    public IActionResult ValidateToken()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = User.FindFirstValue(ClaimTypes.Email);
        var role = User.FindFirstValue(ClaimTypes.Role);
        return Ok(new { message = "Token is valid", user = new { id, email, role } });
    }

    private string GenerateJwtToken(User user)
    {
        var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") ?? configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key or JWT_KEY required.");
        var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? configuration["Jwt:Issuer"] ?? "SwimXpert.Api";
        var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? configuration["Jwt:Audience"] ?? "SwimXpert.Client";
        var expiryMinutes = int.TryParse(Environment.GetEnvironmentVariable("JWT_EXPIRY_MINUTES") ?? configuration["Jwt:ExpiryInMinutes"], out var minutes) && minutes > 0 ? minutes : 60;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class LoginRequest
{
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    [MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    [MaxLength(255)]
    public string? Email { get; set; }
    [MaxLength(128)]
    public string? Password { get; set; }
    [MaxLength(255)]
    public string? FullName { get; set; }
}

public record AuthResponse(int Id, string Email, string FullName, string Role);

public class ResendVerificationRequest
{
    public string? Email { get; set; }
}

public class ForgotPasswordRequest
{
    public string? Email { get; set; }
}

public class ResetPasswordRequest
{
    public string? Token { get; set; }
    public string? NewPassword { get; set; }
}

public class Verify2FaRequest
{
    public string? Email { get; set; }
    public string? Code { get; set; }
}

public class Enable2FaRequest
{
    public string? Code { get; set; }
}

public class Disable2FaRequest
{
    public string? Code { get; set; }
}
