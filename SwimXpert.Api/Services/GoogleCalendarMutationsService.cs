using System.Net;
using System.Text.RegularExpressions;
using Google;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SwimXpert.Api.Data;
using SwimXpert.Api.Models;
using SwimXpert.Api.Options;

namespace SwimXpert.Api.Services;

public class GoogleCalendarMutationsService(
    ApplicationDbContext db,
    IOptions<GoogleCalendarOptions> options) : IGoogleCalendarMutationsService
{
    private readonly GoogleCalendarOptions _opt = options.Value;

    public async Task<(bool Ok, string? Error)> TryDeleteGoogleEventAsync(string? googleEventId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(googleEventId))
            return (true, null);

        var (service, err) = await TryCreateCalendarServiceAsync(ct);
        if (service is null)
            return (false, err);

        try
        {
            await service.Events.Delete(_opt.CalendarId, googleEventId).ExecuteAsync(ct);
            return (true, null);
        }
        catch (GoogleApiException ex) when (ex.HttpStatusCode == HttpStatusCode.NotFound)
        {
            return (true, null);
        }
        catch (GoogleApiException ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> TryPushSessionToGoogleAsync(TrainingSession session, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(session.GoogleEventId))
            return (true, null);

        var (service, err) = await TryCreateCalendarServiceAsync(ct);
        if (service is null)
            return (false, err);

        try
        {
            var ev = await service.Events.Get(_opt.CalendarId, session.GoogleEventId).ExecuteAsync(ct);
            ev.Summary = session.Title;
            var start = DateTime.SpecifyKind(session.StartTime, DateTimeKind.Utc);
            var end = DateTime.SpecifyKind(session.EndTime, DateTimeKind.Utc);
            ev.Start = new EventDateTime
            {
                DateTimeDateTimeOffset = new DateTimeOffset(start, TimeSpan.Zero),
                TimeZone = "UTC"
            };
            ev.End = new EventDateTime
            {
                DateTimeDateTimeOffset = new DateTimeOffset(end, TimeSpan.Zero),
                TimeZone = "UTC"
            };
            ev.Description = MergePriceIntoDescription(ev.Description, session.Price);
            ev.Description = MergeLocationIntoDescription(ev.Description, session.PoolLocation);

            await service.Events.Update(ev, _opt.CalendarId, session.GoogleEventId).ExecuteAsync(ct);
            return (true, null);
        }
        catch (GoogleApiException ex)
        {
            return (false, ex.Message);
        }
    }

    private async Task<(CalendarService? Service, string? Error)> TryCreateCalendarServiceAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_opt.CalendarId))
            return (null, "GoogleCalendar:CalendarId is not configured.");

        var tracked = await db.GoogleCalendarStates.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (string.IsNullOrEmpty(tracked?.RefreshToken))
            return (null, "Google Calendar is not connected.");

        if (string.IsNullOrWhiteSpace(_opt.ClientId) || string.IsNullOrWhiteSpace(_opt.ClientSecret))
            return (null, "Google OAuth is not configured.");

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _opt.ClientId,
                ClientSecret = _opt.ClientSecret
            },
            Scopes = GoogleCalendarScopes.Values
        });

        var credential = new UserCredential(flow, "swimxpert", new TokenResponse { RefreshToken = tracked.RefreshToken });
        var service = new CalendarService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "SwimXpert"
        });
        return (service, null);
    }

    private static string MergePriceIntoDescription(string? description, decimal price)
    {
        var priceLine = $"SwimXpert · Price: ${price:0.00}";
        var d = description ?? "";
        if (System.Text.RegularExpressions.Regex.IsMatch(d, @"SwimXpert · Price:\s*\$?[\d.,]+"))
            return System.Text.RegularExpressions.Regex.Replace(d, @"SwimXpert · Price:\s*\$?[\d.,]+", priceLine);
        return string.IsNullOrWhiteSpace(d) ? priceLine : d.TrimEnd() + "\n\n" + priceLine;
    }

    private static string MergeLocationIntoDescription(string? description, string? poolLocation)
    {
        var loc = (poolLocation ?? "").Trim();
        var locLine = string.IsNullOrEmpty(loc)
            ? "SwimXpert · Location: —"
            : $"SwimXpert · Location: {loc}";
        var d = description ?? "";
        if (Regex.IsMatch(d, @"SwimXpert · Location:\s*.+"))
            return Regex.Replace(d, @"SwimXpert · Location:\s*.+", locLine);
        return string.IsNullOrWhiteSpace(d) ? locLine : d.TrimEnd() + "\n\n" + locLine;
    }
}
