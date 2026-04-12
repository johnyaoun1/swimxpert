using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Calendar.v3;
using System.Globalization;
using System.Text.RegularExpressions;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SwimXpert.Api;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Options;

namespace SwimXpert.Api.Services;

public class GoogleCalendarSyncService(
    ApplicationDbContext db,
    IOptions<GoogleCalendarOptions> options,
    IAuditLogService auditLog) : IGoogleCalendarSyncService
{
    private readonly GoogleCalendarOptions _opt = options.Value;

    public async Task<GoogleCalendarSyncResult> SyncAsync(CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();
        var created = 0;
        var updated = 0;
        var skipped = 0;
        var cancelled = 0;

        if (string.IsNullOrWhiteSpace(_opt.CalendarId))
        {
            errors.Add("GoogleCalendar:CalendarId is not configured.");
            return new GoogleCalendarSyncResult { Errors = errors };
        }

        var tracked = await db.GoogleCalendarStates.FirstOrDefaultAsync(s => s.Id == 1, cancellationToken);
        if (tracked is null)
        {
            tracked = new GoogleCalendarState { Id = 1, UpdatedAt = DateTime.UtcNow };
            db.GoogleCalendarStates.Add(tracked);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (string.IsNullOrEmpty(tracked.RefreshToken))
        {
            errors.Add("Google Calendar is not connected. Use Connect in the admin schedule first.");
            return new GoogleCalendarSyncResult { Errors = errors };
        }

        UserCredential credential;
        try
        {
            credential = CreateUserCredential(tracked.RefreshToken);
        }
        catch (Exception ex)
        {
            errors.Add($"Google auth failed: {ex.Message}");
            return new GoogleCalendarSyncResult { Errors = errors };
        }

        var service = new CalendarService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "SwimXpert"
        });

        var timeMin = DateTime.UtcNow.AddDays(-Math.Max(0, _opt.SyncDaysPast));
        var timeMax = DateTime.UtcNow.AddDays(Math.Max(1, _opt.SyncDaysFuture));

        List<Event> itemList = [];
        try
        {
            string? pageToken = null;
            do
            {
                var request = service.Events.List(_opt.CalendarId);
                request.TimeMinDateTimeOffset = new DateTimeOffset(DateTime.SpecifyKind(timeMin, DateTimeKind.Utc), TimeSpan.Zero);
                request.TimeMaxDateTimeOffset = new DateTimeOffset(DateTime.SpecifyKind(timeMax, DateTimeKind.Utc), TimeSpan.Zero);
                request.SingleEvents = true;
                request.OrderBy = EventsResource.ListRequest.OrderByEnum.StartTime;
                request.ShowDeleted = false;
                request.PageToken = pageToken;
                var eventsPage = await request.ExecuteAsync(cancellationToken);
                if (eventsPage.Items is { Count: > 0 })
                    itemList.AddRange(eventsPage.Items);
                pageToken = eventsPage.NextPageToken;
            } while (!string.IsNullOrEmpty(pageToken));
        }
        catch (Exception ex)
        {
            errors.Add($"Calendar API error: {ex.Message}");
            return new GoogleCalendarSyncResult { Errors = errors };
        }

        var items = itemList;

        foreach (var ev in items)
        {
            if (string.IsNullOrEmpty(ev.Id))
            {
                skipped++;
                continue;
            }

            if (!TryGetUtcRange(ev, out var startUtc, out var endUtc))
            {
                skipped++;
                continue;
            }

            if (string.Equals(ev.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            {
                var existing = await db.TrainingSessions.FirstOrDefaultAsync(
                    s => s.GoogleEventId == ev.Id, cancellationToken);
                if (existing is not null && !string.Equals(existing.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
                {
                    existing.Status = "Cancelled";
                    cancelled++;
                }
                continue;
            }

            var title = string.IsNullOrWhiteSpace(ev.Summary) ? "Google event" : ev.Summary.Trim();
            if (title.Length > 200)
                title = title[..200];

            var priceFromGoogle = ParsePriceFromEvent(ev);
            var locationFromGoogle = ParseLocationFromEvent(ev);

            var existingByGoogle = await db.TrainingSessions.FirstOrDefaultAsync(
                s => s.GoogleEventId == ev.Id, cancellationToken);

            if (existingByGoogle is null)
            {
                db.TrainingSessions.Add(new TrainingSession
                {
                    Title = title,
                    StartTime = startUtc,
                    EndTime = endUtc,
                    Capacity = 10,
                    Status = "Scheduled",
                    Price = priceFromGoogle,
                    PoolLocation = locationFromGoogle,
                    IsPaid = false,
                    GoogleEventId = ev.Id,
                    CreatedAt = DateTime.UtcNow
                });
                created++;
            }
            else
            {
                existingByGoogle.Title = title;
                existingByGoogle.StartTime = startUtc;
                existingByGoogle.EndTime = endUtc;
                existingByGoogle.GoogleEventId = ev.Id;
                if (priceFromGoogle > 0)
                    existingByGoogle.Price = priceFromGoogle;
                if (!string.IsNullOrWhiteSpace(locationFromGoogle))
                    existingByGoogle.PoolLocation = locationFromGoogle.Trim();
                updated++;
            }
        }

        tracked.LastSyncUtc = DateTime.UtcNow;
        tracked.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        await auditLog.LogAsync("GoogleCalendarSynced", "GoogleCalendar", "1", new { created, updated, skipped, cancelled });

        return new GoogleCalendarSyncResult
        {
            Created = created,
            Updated = updated,
            Skipped = skipped,
            CancelledInDb = cancelled,
            Errors = errors
        };
    }

    private UserCredential CreateUserCredential(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(_opt.ClientId) || string.IsNullOrWhiteSpace(_opt.ClientSecret))
            throw new InvalidOperationException("Google OAuth client is not configured.");

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _opt.ClientId,
                ClientSecret = _opt.ClientSecret
            },
            Scopes = GoogleCalendarScopes.Values
        });

        var token = new TokenResponse { RefreshToken = refreshToken };
        return new UserCredential(flow, "swimxpert", token);
    }

    private static bool TryGetUtcRange(Event ev, out DateTime startUtc, out DateTime endUtc)
    {
        startUtc = default;
        endUtc = default;
        if (ev.Start?.DateTimeDateTimeOffset is { } sOff && ev.End?.DateTimeDateTimeOffset is { } eOff)
        {
            startUtc = sOff.UtcDateTime;
            endUtc = eOff.UtcDateTime;
            return endUtc > startUtc;
        }

        return false;
    }

    private static decimal ParsePriceFromEvent(Event ev)
    {
        var desc = ev.Description ?? "";
        var m = Regex.Match(desc, @"SwimXpert · Price:\s*\$?\s*([\d.,]+)", RegexOptions.IgnoreCase);
        if (m.Success && decimal.TryParse(m.Groups[1].Value.Replace(",", ""), NumberStyles.Any, CultureInfo.InvariantCulture, out var x))
            return x < 0 ? 0 : x;

        return 0;
    }

    private static string? ParseLocationFromEvent(Event ev)
    {
        var desc = ev.Description ?? "";
        var m = Regex.Match(desc, @"SwimXpert · Location:\s*([^\r\n]+)", RegexOptions.IgnoreCase);
        if (!m.Success) return null;
        var raw = m.Groups[1].Value.Trim();
        if (string.IsNullOrEmpty(raw) || raw == "—") return null;
        return raw.Length > 500 ? raw[..500] : raw;
    }
}
