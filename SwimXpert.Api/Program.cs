using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Allow ALLOWED_HOSTS env var to override appsettings (e.g. "swimxpert.com" in production).
var allowedHostsEnv = Environment.GetEnvironmentVariable("ALLOWED_HOSTS");
if (!string.IsNullOrWhiteSpace(allowedHostsEnv))
    builder.Configuration["AllowedHosts"] = allowedHostsEnv;

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 5 * 1024 * 1024; // 5 MB
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT token}"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var allowedOrigins = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS")
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:4200" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularApp", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection or DATABASE_URL is required.");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddHttpClient();

if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CLOUDINARY_CLOUD_NAME")))
    builder.Services.AddSingleton<IStorageService, CloudinaryStorageService>();
else
    builder.Services.AddSingleton<IStorageService, LocalStorageService>();

var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key or JWT_KEY environment variable is required.");

// Refuse to start in production with the well-known dev key.
const string devKey = "DevKey_ChangeForProduction_Min32CharsRequired";
if (!builder.Environment.IsDevelopment() && jwtKey == devKey)
    throw new InvalidOperationException("Production startup blocked: set a unique JWT_KEY environment variable.");
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? builder.Configuration["Jwt:Issuer"] ?? "SwimXpert.Api";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? builder.Configuration["Jwt:Audience"] ?? "SwimXpert.Client";
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = signingKey,
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Cookies["access_token"];
            if (!string.IsNullOrEmpty(token))
                context.Token = token;
            return Task.CompletedTask;
        }
    };
});

var app = builder.Build();

app.UseMiddleware<SwimXpert.Api.Middleware.GlobalExceptionMiddleware>();
app.UseMiddleware<SwimXpert.Api.Middleware.SecurityHeadersMiddleware>();
app.UseMiddleware<SwimXpert.Api.Middleware.RateLimitMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AngularApp");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Swimmers\" ADD COLUMN IF NOT EXISTS \"ProfilePictureUrl\" character varying(500);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Swimmers\" ADD COLUMN IF NOT EXISTS \"SkillProgressJson\" text NOT NULL DEFAULT '{{}}';");
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "LeadCaptures" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "Name" character varying(150) NOT NULL,
            "Email" character varying(200),
            "Phone" character varying(30),
            "SourcePage" character varying(200),
            "SourceAction" character varying(200),
            "UserAgent" character varying(400),
            "IsContacted" boolean NOT NULL DEFAULT FALSE,
            "ContactedAt" timestamp with time zone,
            "CreatedAt" timestamp with time zone NOT NULL
        );
    """);
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"LeadCaptures\" ADD COLUMN IF NOT EXISTS \"IsContacted\" boolean NOT NULL DEFAULT FALSE;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"LeadCaptures\" ADD COLUMN IF NOT EXISTS \"ContactedAt\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS \"IX_LeadCaptures_CreatedAt\" ON \"LeadCaptures\" (\"CreatedAt\");");
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "ProgressEntries" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "SwimmerId" integer NOT NULL REFERENCES "Swimmers"("Id") ON DELETE CASCADE,
            "EntryDate" timestamp with time zone NOT NULL,
            "Level" integer NOT NULL,
            "Notes" character varying(1000) NOT NULL DEFAULT '',
            "SkillsJson" text NOT NULL DEFAULT '[]',
            "CreatedAt" timestamp with time zone NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "IX_ProgressEntries_SwimmerId" ON "ProgressEntries" ("SwimmerId");
    """);
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "QuizResults" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "UserId" integer NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
            "Score" integer NOT NULL,
            "TotalQuestions" integer NOT NULL,
            "Percentage" integer NOT NULL,
            "Timestamp" timestamp with time zone NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "IX_QuizResults_UserId" ON "QuizResults" ("UserId");
    """);
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"EmailVerified\" boolean NOT NULL DEFAULT true;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"EmailVerificationTokenHash\" character varying(64);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"EmailVerificationTokenExpiry\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"FailedLoginAttempts\" integer NOT NULL DEFAULT 0;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"LockoutUntil\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"PasswordResetTokenHash\" character varying(64);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"PasswordResetTokenExpiry\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"TwoFactorEnabled\" boolean NOT NULL DEFAULT false;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"TwoFactorSecret\" character varying(256);");
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "RefreshTokens" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "UserId" integer NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
            "TokenHash" character varying(64) NOT NULL,
            "ExpiresAt" timestamp with time zone NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL,
            "RevokedAt" timestamp with time zone,
            "ReplacedByTokenHash" character varying(64)
        );
        CREATE INDEX IF NOT EXISTS "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_RefreshTokens_TokenHash" ON "RefreshTokens" ("TokenHash");
    """);
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "AuditLogs" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "AdminUserId" integer NOT NULL,
            "AdminEmail" character varying(255) NOT NULL,
            "Action" character varying(100) NOT NULL,
            "TargetType" character varying(100),
            "TargetId" character varying(50),
            "Details" text,
            "Timestamp" timestamp with time zone NOT NULL,
            "IpAddress" character varying(45)
        );
        CREATE INDEX IF NOT EXISTS "IX_AuditLogs_Timestamp" ON "AuditLogs" ("Timestamp");
        CREATE INDEX IF NOT EXISTS "IX_AuditLogs_Action" ON "AuditLogs" ("Action");
    """);

    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"PoolLocation\" character varying(200);");

    var adminEmail = Environment.GetEnvironmentVariable("INITIAL_ADMIN_EMAIL");
    var adminPassword = Environment.GetEnvironmentVariable("INITIAL_ADMIN_PASSWORD");
    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword)
        && !await db.Users.AnyAsync(u => u.Email == adminEmail.Trim().ToLowerInvariant()))
    {
        db.Users.Add(new User
        {
            Email = adminEmail.Trim().ToLowerInvariant(),
            Password = BCrypt.Net.BCrypt.HashPassword(adminPassword, 12),
            FullName = "SwimXpert Admin",
            Role = "Admin",
            EmailVerified = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
}

await app.RunAsync();
