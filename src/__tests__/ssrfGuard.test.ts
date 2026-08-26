import { describe, it, expect, vi, beforeEach } from "vitest";
import { ipv4Octets, isPrivateIPv4, ipv6Groups, isPrivateAddress, resolvePublicAddress } from "@/lib/ssrfGuard";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("dns/promises", () => ({ lookup: lookupMock }));

// This is the control that stops a caller pointing the video downloader at loopback,
// RFC-1918 space, or a cloud metadata endpoint. Anything it wrongly calls public is a
// server-side request forgery.
const BLOCKED = [
  ["loopback", "127.0.0.1"],
  ["loopback, non-canonical", "127.1.2.3"],
  ["this-network", "0.0.0.0"],
  ["RFC-1918 10/8", "10.1.2.3"],
  ["RFC-1918 172.16/12 low", "172.16.0.1"],
  ["RFC-1918 172.16/12 high", "172.31.255.255"],
  ["RFC-1918 192.168/16", "192.168.1.1"],
  ["AWS/GCP metadata", "169.254.169.254"],
  ["link-local", "169.254.0.1"],
  ["CGNAT", "100.64.0.1"],
  ["benchmarking", "198.18.0.1"],
  ["multicast", "224.0.0.1"],
  ["reserved high", "255.255.255.255"],
  ["IPv6 loopback", "::1"],
  ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
  ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
  ["IPv4-compatible metadata", "::169.254.169.254"],
  ["NAT64 metadata", "64:ff9b::a9fe:a9fe"],
  ["6to4 metadata", "2002:a9fe:a9fe::"],
  ["IPv6 link-local", "fe80::1"],
  ["IPv6 unique-local", "fd12:3456::1"],
  ["IPv6 multicast", "ff02::1"],
  ["malformed", "not-an-address"],
  ["empty", ""],
  ["truncated IPv4", "10.1.2"],
  ["octet out of range", "999.1.1.1"],
] as const;

const ALLOWED = [
  ["public IPv4", "93.184.216.34"],
  ["public IPv4, Google DNS", "8.8.8.8"],
  ["just outside CGNAT", "100.128.0.1"],
  ["just outside 172.16/12", "172.32.0.1"],
  ["just below multicast", "223.255.255.255"],
  ["public IPv6", "2606:4700:4700::1111"],
  ["IPv4-mapped public", "::ffff:93.184.216.34"],
] as const;

describe("isPrivateAddress", () => {
  for (const [label, address] of BLOCKED) {
    it(`blocks ${label} (${address || "<empty>"})`, () => {
      expect(isPrivateAddress(address)).toBe(true);
    });
  }

  for (const [label, address] of ALLOWED) {
    it(`allows ${label} (${address})`, () => {
      expect(isPrivateAddress(address)).toBe(false);
    });
  }
});

describe("ipv4Octets", () => {
  it("parses a dotted quad", () => {
    expect(ipv4Octets("1.2.3.4")).toEqual([1, 2, 3, 4]);
  });

  it("rejects anything that is not four numeric octets in range", () => {
    for (const bad of ["1.2.3", "1.2.3.4.5", "1.2.3.256", "1.2.3.a", "01.02.03.04.05", ""]) {
      expect(ipv4Octets(bad)).toBeNull();
    }
  });
});

describe("ipv6Groups", () => {
  it("expands a compressed address to eight groups", () => {
    expect(ipv6Groups("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(ipv6Groups("2606:4700:4700::1111")).toHaveLength(8);
  });

  it("strips a zone suffix", () => {
    expect(ipv6Groups("fe80::1%eth0")).toEqual(ipv6Groups("fe80::1"));
  });

  it("rejects an address with two compression markers", () => {
    expect(ipv6Groups("1::2::3")).toBeNull();
  });

  it("treats an unparseable address as private, failing closed", () => {
    expect(isPrivateAddress("1::2::3")).toBe(true);
  });
});

describe("isPrivateIPv4", () => {
  it("judges the embedded quad, not the text form", () => {
    expect(isPrivateIPv4([169, 254, 169, 254])).toBe(true);
    expect(isPrivateIPv4([93, 184, 216, 34])).toBe(false);
  });
});

describe("resolvePublicAddress", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it("returns a literal public IP without a DNS lookup", async () => {
    await expect(resolvePublicAddress("93.184.216.34")).resolves.toEqual({
      address: "93.184.216.34", family: 4,
    });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("refuses a literal private IP without a DNS lookup", async () => {
    await expect(resolvePublicAddress("169.254.169.254")).resolves.toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("unwraps a bracketed IPv6 literal", async () => {
    await expect(resolvePublicAddress("[::1]")).resolves.toBeNull();
  });

  it("resolves a public hostname to its address", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(resolvePublicAddress("example.com")).resolves.toEqual({
      address: "93.184.216.34", family: 4,
    });
  });

  it("refuses a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(resolvePublicAddress("metadata.internal")).resolves.toBeNull();
  });

  it("refuses when ANY resolved address is private, not just the first", async () => {
    // A rebinding-style answer that mixes a public address with a private one must not
    // be accepted on the strength of its first entry.
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(resolvePublicAddress("rebind.example")).resolves.toBeNull();
  });

  it("refuses a hostname that resolves to nothing", async () => {
    lookupMock.mockResolvedValue([]);
    await expect(resolvePublicAddress("nowhere.example")).resolves.toBeNull();
  });

  it("refuses when the lookup itself fails", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(resolvePublicAddress("broken.example")).resolves.toBeNull();
  });

  it("refuses an empty hostname", async () => {
    await expect(resolvePublicAddress("")).resolves.toBeNull();
  });
});
