using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Options;
using SwimXpert.Api.Services;
using System.Text;

using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Google OAuth: do not commit real ClientId/ClientSecret. Use user secrets (dev) or env vars, e.g.:
// GoogleCalendar__ClientId, GoogleCalendar__ClientSecret, GoogleCalendar__CalendarId
// or GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET / GOOGLE_CALENDAR_CALENDAR_ID
var gClientId = Environment.GetEnvironmentVariable("GOOGLE_CALENDAR_CLIENT_ID");
var gClientSecret = Environment.GetEnvironmentVariable("GOOGLE_CALENDAR_CLIENT_SECRET");
var gCalendarId = Environment.GetEnvironmentVariable("GOOGLE_CALENDAR_CALENDAR_ID");
if (!string.IsNullOrEmpty(gClientId))
    builder.Configuration["GoogleCalendar:ClientId"] = gClientId;
if (!string.IsNullOrEmpty(gClientSecret))
    builder.Configuration["GoogleCalendar:ClientSecret"] = gClientSecret;
if (!string.IsNullOrEmpty(gCalendarId))
    builder.Configuration["GoogleCalendar:CalendarId"] = gCalendarId;

// Allow ALLOWED_HOSTS env var to override appsettings (e.g. "swimxpert.com" in production).
var allowedHostsEnv = Environment.GetEnvironmentVariable("ALLOWED_HOSTS");
if (!string.IsNullOrWhiteSpace(allowedHostsEnv))
    builder.Configuration["AllowedHosts"] = allowedHostsEnv;

// Railway / reverse proxies terminate TLS and forward X-Forwarded-*.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    // Only one trusted hop: Railway's edge proxy → this container.
    options.ForwardLimit = 1;
    // Railway's edge IPs are dynamic but always reach the container over the internal
    // network, so trust forwarded headers only from private ranges — never from a
    // request that arrived directly from the public internet.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
    foreach (var network in SwimXpert.Api.TrustedProxyNetworks.All)
        options.KnownNetworks.Add(network);
});

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

// Same-origin reverse proxy (recommended): browser calls https://yourdomain.com/api → no CORS preflight needed.
// Still set CORS_ALLOWED_ORIGINS to the public site origin(s) so direct API hits and local Angular (localhost:4200) work.
// Never use AllowAnyOrigin() with AllowCredentials().
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

var connectionString = PostgresConnectionString.Resolve(builder.Configuration);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IClientMatchingService, ClientMatchingService>();
builder.Services.AddScoped<ParentBookingGate>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.Configure<GoogleCalendarOptions>(builder.Configuration.GetSection(GoogleCalendarOptions.SectionName));
builder.Services.AddScoped<IGoogleCalendarSyncService, GoogleCalendarSyncService>();
builder.Services.AddScoped<IGoogleCalendarMutationsService, GoogleCalendarMutationsService>();

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

// Must run first so Request.Scheme/Host reflect the public HTTPS hostname behind Railway/nginx.
app.UseForwardedHeaders();

app.UseMiddleware<SwimXpert.Api.Middleware.GlobalExceptionMiddleware>();
// CORS before rate-limit/security so preflight and error responses include ACAO headers.
app.UseCors("AngularApp");
app.UseMiddleware<SwimXpert.Api.Middleware.SecurityHeadersMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Profile photos are not public. /uploads returns 404; GET /api/profile-pictures checks ownership first.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/uploads"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next();
});
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
// After authentication so the per-user limit can read the JWT name identifier.
// Anonymous limits still key off ClientIpResolver.
app.UseMiddleware<SwimXpert.Api.Middleware.RateLimitMiddleware>();
app.UseMiddleware<SwimXpert.Api.Middleware.TokenVersionMiddleware>();
app.UseMiddleware<SwimXpert.Api.Middleware.MustChangePasswordMiddleware>();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Swimmers\" ADD COLUMN IF NOT EXISTS \"ProfilePictureUrl\" character varying(500);");
    // Older local uploads were saved as absolute URLs. Keep the path; leave Cloudinary locators unchanged.
    await db.Database.ExecuteSqlRawAsync("""
        UPDATE "Swimmers"
        SET "ProfilePictureUrl" = regexp_replace(
            "ProfilePictureUrl",
            '^https?://[^/]+(/uploads/profile-pictures/[a-fA-F0-9]{{32}}\.(jpg|jpeg|png|gif|webp))$',
            '\1'
        )
        WHERE "ProfilePictureUrl" ~ '^https?://[^/]+/uploads/profile-pictures/[a-fA-F0-9]{{32}}\.(jpg|jpeg|png|gif|webp)$';
    """);
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
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"Username\" character varying(100);");
    await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Users_Username\" ON \"Users\" (\"Username\") WHERE \"Username\" IS NOT NULL;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"Phone\" character varying(30);");
    // IsApproved: existing rows stay approved. Self-signup sets false in Register.
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"IsApproved\" boolean NOT NULL DEFAULT true;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"EmailVerified\" boolean NOT NULL DEFAULT true;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"ClientStatus\" character varying(20) NOT NULL DEFAULT 'New';");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Swimmers\" ADD COLUMN IF NOT EXISTS \"IsAccountHolder\" boolean NOT NULL DEFAULT false;");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS \"IX_Swimmers_ParentUserId_IsAccountHolder\" ON \"Swimmers\" (\"ParentUserId\", \"IsAccountHolder\");");
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "LegacyClients" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "PhoneNormalized" character varying(32) NOT NULL,
            "DisplayName" character varying(255),
            "Source" character varying(64),
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
        );
    """);
    await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_LegacyClients_PhoneNormalized\" ON \"LegacyClients\" (\"PhoneNormalized\");");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"EmailVerificationTokenHash\" character varying(64);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"EmailVerificationTokenExpiry\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"FailedLoginAttempts\" integer NOT NULL DEFAULT 0;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"LockoutUntil\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"PasswordResetTokenHash\" character varying(64);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"PasswordResetTokenExpiry\" timestamp with time zone;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"MustChangePassword\" boolean NOT NULL DEFAULT false;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"TokenVersion\" integer NOT NULL DEFAULT 0;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"TwoFactorEnabled\" boolean NOT NULL DEFAULT false;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" ADD COLUMN IF NOT EXISTS \"TwoFactorSecret\" character varying(256);");
    // Permanently remove reversible password backups if a prior build created this column.
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Users\" DROP COLUMN IF EXISTS \"AdminPasswordRevealCipher\";");
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

    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"CoachUserId\" integer;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"CoachAccepted\" boolean;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"CoachDeclineReason\" character varying(2000);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Attendances\" ADD COLUMN IF NOT EXISTS \"BookingStatus\" character varying(20) NOT NULL DEFAULT 'Confirmed';");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS \"IX_Attendances_BookingStatus\" ON \"Attendances\" (\"BookingStatus\");");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"PoolLocation\" character varying(200);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"Price\" numeric(18,2) NOT NULL DEFAULT 0;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"IsPaid\" boolean NOT NULL DEFAULT FALSE;");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"GoogleEventId\" character varying(200);");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"RecurrenceSeriesId\" uuid;");
    await db.Database.ExecuteSqlRawAsync(
        """CREATE INDEX IF NOT EXISTS "IX_TrainingSessions_RecurrenceSeriesId" ON "TrainingSessions" ("RecurrenceSeriesId");""");
    await db.Database.ExecuteSqlRawAsync(
        """CREATE INDEX IF NOT EXISTS "IX_TrainingSessions_StartTime" ON "TrainingSessions" ("StartTime");""");
    await db.Database.ExecuteSqlRawAsync(
        """CREATE UNIQUE INDEX IF NOT EXISTS "IX_TrainingSessions_GoogleEventId_unique" ON "TrainingSessions" ("GoogleEventId") WHERE "GoogleEventId" IS NOT NULL;""");
    await db.Database.ExecuteSqlRawAsync(
        """
        CREATE TABLE IF NOT EXISTS "GoogleCalendarStates" (
            "Id" integer NOT NULL PRIMARY KEY,
            "RefreshToken" text,
            "LastSyncUtc" timestamp with time zone,
            "UpdatedAt" timestamp with time zone NOT NULL
        );
        """);

    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Payments\" ADD COLUMN IF NOT EXISTS \"RecordedByUserId\" integer;");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS \"IX_Payments_RecordedByUserId\" ON \"Payments\" (\"RecordedByUserId\");");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Payments\" DROP CONSTRAINT IF EXISTS \"FK_Payments_Users_RecordedByUserId\";");
    await db.Database.ExecuteSqlRawAsync(
        """
        ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Users_RecordedByUserId"
        FOREIGN KEY ("RecordedByUserId") REFERENCES "Users" ("Id") ON DELETE SET NULL;
        """);
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Payments\" ADD COLUMN IF NOT EXISTS \"AttendanceId\" integer;");
    await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS \"IX_Payments_AttendanceId\" ON \"Payments\" (\"AttendanceId\");");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Payments\" DROP CONSTRAINT IF EXISTS \"FK_Payments_Attendances_AttendanceId\";");
    await db.Database.ExecuteSqlRawAsync(
        """
        ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Attendances_AttendanceId"
        FOREIGN KEY ("AttendanceId") REFERENCES "Attendances" ("Id") ON DELETE SET NULL;
        """);
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Payments\" DROP CONSTRAINT IF EXISTS \"FK_Payments_Users_UserId\";");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Payments\" ALTER COLUMN \"UserId\" DROP NOT NULL;");
    await db.Database.ExecuteSqlRawAsync(
        """
        ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Users_UserId"
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE SET NULL;
        """);

    var adminEmail = Environment.GetEnvironmentVariable("INITIAL_ADMIN_EMAIL");
    var adminPassword = Environment.GetEnvironmentVariable("INITIAL_ADMIN_PASSWORD");
    // Seed only when the database has no admin. An existing admin with a different
    // email must not cause a second admin to be created.
    var hasAdmin = await db.Users.AnyAsync(u => u.Role.ToLower() == "admin");
    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword) && !hasAdmin)
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

// Optional: seed LegacyClients from deploy/legacy-clients.csv for Returning matching
using (var scope = app.Services.CreateScope())
{
    var matcher = scope.ServiceProvider.GetRequiredService<IClientMatchingService>();
    await matcher.EnsureLegacySeedFromCsvAsync();
}

await app.RunAsync();
