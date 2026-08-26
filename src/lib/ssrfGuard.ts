import { lookup } from "dns/promises";
import type { LookupAddress } from "dns";
import { isIPv4, isIPv6 } from "net";

// SSRF guard for user-supplied video URLs. Extracted from the extract-frames route so it
// can be tested directly: this is the control that stops a caller pointing the downloader
// at loopback, RFC-1918, or cloud-metadata addresses, and it had no coverage while it
// lived as module-private helpers.

export function ipv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

// Loopback, RFC-1918 private, link-local (cloud metadata), CGNAT, benchmarking, multicast, reserved
export function isPrivateIPv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return a >= 224;
}

// Expand any IPv6 text form (compressed, zone-suffixed, embedded IPv4) into its 8 groups
export function ipv6Groups(address: string): number[] | null {
  const halves = address.split("%")[0].split("::");
  if (halves.length > 2) return null;

  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const groups: number[] = [];
    for (const part of half.split(":")) {
      if (part.includes(".")) {
        const octets = ipv4Octets(part);
        if (!octets) return null;
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
        groups.push(parseInt(part, 16));
      }
    }
    return groups;
  };

  const head = parseHalf(halves[0]);
  const tail = halves.length === 2 ? parseHalf(halves[1]) : [];
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}

export function isPrivateIPv6(address: string): boolean {
  const g = ipv6Groups(address);
  if (!g) return true;
  const embeddedIPv4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff];
  // IPv4-mapped/compatible (::ffff:a.b.c.d, ::a.b.c.d), NAT64 and 6to4 — judge the embedded IPv4
  const zeroPrefix = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
  if (zeroPrefix && (g[5] === 0xffff || g[5] === 0)) return isPrivateIPv4(embeddedIPv4);
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isPrivateIPv4(embeddedIPv4);
  }
  if (g[0] === 0x2002) return isPrivateIPv4([g[1] >> 8, g[1] & 0xff, g[2] >> 8, g[2] & 0xff]);
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique-local
  return (g[0] & 0xff00) === 0xff00; // multicast
}

export function isPrivateAddress(address: string): boolean {
  if (isIPv4(address)) {
    const octets = ipv4Octets(address);
    return octets === null || isPrivateIPv4(octets);
  }
  if (isIPv6(address)) return isPrivateIPv6(address);
  return true;
}

// A hostname is only public if every address it resolves to is public — a literal
// blocklist misses DNS names that point at loopback/metadata addresses. The address
// that passed is returned so the request can be pinned to it: re-resolving at connect
// time would let a rebinding DNS answer swap in a private address after the check.
export async function resolvePublicAddress(hostname: string): Promise<LookupAddress | null> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return null;
  if (isIPv4(host)) return isPrivateAddress(host) ? null : { address: host, family: 4 };
  if (isIPv6(host)) return isPrivateAddress(host) ? null : { address: host, family: 6 };

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return null;
    if (addresses.some(({ address }) => isPrivateAddress(address))) return null;
    return addresses[0];
  } catch {
    return null;
  }
}
