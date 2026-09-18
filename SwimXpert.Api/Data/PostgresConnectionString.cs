using Npgsql;

namespace SwimXpert.Api.Data;

/// <summary>
/// Resolves Postgres connection strings for local Npgsql keyword format and
/// Railway-style DATABASE_URL URIs (postgres:// / postgresql://).
/// </summary>
public static class PostgresConnectionString
{
    /// <summary>
    /// Prefer <c>DATABASE_URL</c> (URI or keyword format), else
    /// <c>ConnectionStrings:DefaultConnection</c> from configuration.
    /// </summary>
    public static string Resolve(IConfiguration configuration)
    {
        var raw = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection or DATABASE_URL is required.");

        return Normalize(raw);
    }

    /// <summary>
    /// Converts a postgres:// URI into an Npgsql connection string.
    /// Already-keyword strings (Host=...;...) are returned unchanged.
    /// </summary>
    public static string Normalize(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Database connection string is empty.");

        var trimmed = value.Trim().Trim('"');

        // Railway / Heroku style URI
        if (trimmed.Contains("://", StringComparison.Ordinal))
            return FromUri(trimmed);

        // Existing local / keyword format (Host=...;Port=...)
        return trimmed;
    }

    private static string FromUri(string uriString)
    {
        if (!Uri.TryCreate(uriString, UriKind.Absolute, out var uri))
            throw new InvalidOperationException("DATABASE_URL is not a valid absolute URI.");

        if (!uri.Scheme.Equals("postgres", StringComparison.OrdinalIgnoreCase)
            && !uri.Scheme.Equals("postgresql", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"DATABASE_URL scheme must be postgres:// or postgresql:// (got '{uri.Scheme}').");
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var username = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(0) ?? "");
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));

        if (string.IsNullOrEmpty(uri.Host))
            throw new InvalidOperationException("DATABASE_URL is missing a host.");
        if (string.IsNullOrEmpty(database))
            throw new InvalidOperationException("DATABASE_URL is missing a database name.");

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = database,
            Username = username,
            Password = password
        };

        ApplyQuerySslSettings(uri.Query, builder);

        return builder.ConnectionString;
    }

    private static void ApplyQuerySslSettings(string query, NpgsqlConnectionStringBuilder builder)
    {
        if (string.IsNullOrEmpty(query))
            return;

        foreach (var part in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = part.Split('=', 2);
            var key = Uri.UnescapeDataString(kv[0]).ToLowerInvariant();
            var val = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : "";

            if (key is not ("sslmode" or "ssl mode"))
                continue;

            builder.SslMode = val.ToLowerInvariant() switch
            {
                "disable" => SslMode.Disable,
                "allow" => SslMode.Allow,
                "prefer" => SslMode.Prefer,
                "require" => SslMode.Require,
                "verify-ca" or "verifyca" => SslMode.VerifyCA,
                "verify-full" or "verifyfull" => SslMode.VerifyFull,
                _ => Enum.TryParse<SslMode>(val, ignoreCase: true, out var parsed)
                    ? parsed
                    : throw new InvalidOperationException(
                        $"Unsupported sslmode in DATABASE_URL: '{val}'.")
            };

        }
    }
}
