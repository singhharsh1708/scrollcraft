import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/rateLimit";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://scrollcraft.app/api/x", { headers });
}

describe("getClientIp", () => {
  it("prefers the Vercel-signed header over x-forwarded-for", () => {
    const ip = getClientIp(reqWith({
      "x-vercel-forwarded-for": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    }));
    expect(ip).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip before x-forwarded-for", () => {
    const ip = getClientIp(reqWith({
      "x-real-ip": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1",
    }));
    expect(ip).toBe("9.9.9.9");
  });

  it("reads x-forwarded-for right-to-left so a spoofed left entry is ignored", () => {
    // A client can prepend anything; only the rightmost hop is trustworthy.
    const ip = getClientIp(reqWith({ "x-forwarded-for": "6.6.6.6, 3.3.3.3" }));
    expect(ip).toBe("3.3.3.3");
  });

  it("skips junk hops and returns the rightmost valid IP", () => {
    const ip = getClientIp(reqWith({ "x-forwarded-for": "3.3.3.3, not-an-ip" }));
    expect(ip).toBe("3.3.3.3");
  });

  it("strips a port from an IPv4 address", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "1.2.3.4:5678" }))).toBe("1.2.3.4");
  });

  it("unwraps a bracketed IPv6 address with a port", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "[2001:db8::1]:443" }))).toBe("2001:db8::1");
  });

  it("accepts a bare IPv6 address", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("returns 'unknown' when nothing attributable is present", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
    expect(getClientIp(reqWith({ "x-forwarded-for": "garbage, also-garbage" }))).toBe("unknown");
  });

  it("shares one 'unknown' bucket so unattributable traffic stays capped in aggregate", () => {
    // Two requests with no usable header must map to the same key, not a fresh allowance each.
    expect(getClientIp(reqWith({ "x-real-ip": "" }))).toBe("unknown");
    expect(getClientIp(reqWith({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});
