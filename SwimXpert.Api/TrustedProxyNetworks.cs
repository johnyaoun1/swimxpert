using System.Net;
using IPNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

namespace SwimXpert.Api;

/// <summary>
/// Networks allowed to set X-Forwarded-* headers. Railway's edge proxy reaches the
/// container over the platform's internal network, so only private/loopback ranges
/// are trusted — a request arriving straight from the public internet can never
/// have its forwarded headers honoured.
/// </summary>
public static class TrustedProxyNetworks
{
    public static IReadOnlyList<IPNetwork> All { get; } =
    [
        new(IPAddress.Parse("127.0.0.0"), 8),        // IPv4 loopback
        new(IPAddress.Parse("10.0.0.0"), 8),         // RFC1918
        new(IPAddress.Parse("172.16.0.0"), 12),      // RFC1918
        new(IPAddress.Parse("192.168.0.0"), 16),     // RFC1918
        new(IPAddress.Parse("100.64.0.0"), 10),      // RFC6598 carrier-grade NAT
        new(IPAddress.Parse("::1"), 128),            // IPv6 loopback
        new(IPAddress.Parse("fc00::"), 7),           // IPv6 unique local (Railway private net)
        new(IPAddress.Parse("fe80::"), 10)           // IPv6 link-local
    ];
}
