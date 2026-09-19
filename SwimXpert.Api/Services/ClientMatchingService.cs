using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Services;

public interface IClientMatchingService
{
    Task<string> ResolveClientStatusAsync(string? phone, CancellationToken cancellationToken = default);
    Task EnsureLegacySeedFromCsvAsync(CancellationToken cancellationToken = default);
}

public class ClientMatchingService(ApplicationDbContext db, IWebHostEnvironment env, ILogger<ClientMatchingService> logger) : IClientMatchingService
{
    public async Task<string> ResolveClientStatusAsync(string? phone, CancellationToken cancellationToken = default)
    {
        var normalized = LebanesePhoneNormalizer.Normalize(phone);
        if (string.IsNullOrEmpty(normalized))
            return ClientStatuses.New;

        var hit = await db.LegacyClients.AsNoTracking()
            .AnyAsync(c => c.PhoneNormalized == normalized, cancellationToken);
        return hit ? ClientStatuses.Returning : ClientStatuses.New;
    }

    /// <summary>
    /// Optional one-shot seed from deploy/legacy-clients.csv (Phone,Name).
    /// Safe to call at startup; skips if file missing or rows already exist for that phone.
    /// </summary>
    public async Task EnsureLegacySeedFromCsvAsync(CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(env.ContentRootPath, "..", "deploy", "legacy-clients.csv");
        if (!File.Exists(path))
            path = Path.Combine(Directory.GetCurrentDirectory(), "deploy", "legacy-clients.csv");
        if (!File.Exists(path))
            return;

        var lines = await File.ReadAllLinesAsync(path, cancellationToken);
        var added = 0;
        foreach (var line in lines.Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith('#'))
                continue;
            var parts = line.Split(',', 2, StringSplitOptions.TrimEntries);
            if (parts.Length == 0)
                continue;
            var normalized = LebanesePhoneNormalizer.Normalize(parts[0]);
            if (string.IsNullOrEmpty(normalized))
                continue;
            if (await db.LegacyClients.AnyAsync(c => c.PhoneNormalized == normalized, cancellationToken))
                continue;
            db.LegacyClients.Add(new LegacyClient
            {
                PhoneNormalized = normalized,
                DisplayName = parts.Length > 1 ? parts[1] : null,
                Source = "csv",
                CreatedAt = DateTime.UtcNow
            });
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded {Count} legacy client phone(s) from CSV.", added);
        }
    }
}
