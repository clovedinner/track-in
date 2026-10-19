import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import { isPublicPostbackAddress, sendPublicPostback, UnsafePostbackDestinationError } from "./postback-transport";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

describe("postback destination protection", () => {
  it("blocks a hostname with mixed public and private DNS answers", async () => {
    const lookupAll: (hostname: string, options: { all: true }) => Promise<LookupAddress[]> = lookup;
    vi.mocked(lookupAll).mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(sendPublicPostback({ url: "https://mixed.example/postback", method: "GET", headers: { accept: "*/*" } })).rejects.toBeInstanceOf(UnsafePostbackDestinationError);
  });
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2002:7f00:1::", "2001:db8::1"])("rejects non-public address %s", (address) => {
    expect(isPublicPostbackAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])("permits public address %s", (address) => {
    expect(isPublicPostbackAddress(address)).toBe(true);
  });
  it.each(["http://127.0.0.1/postback", "http://[::1]/postback", "http://0x7f000001/postback", "http://169.254.169.254/latest"])("blocks internal endpoints without sending a request: %s", async (url) => {
    await expect(sendPublicPostback({ url, method: "GET", headers: { accept: "*/*" } })).rejects.toBeInstanceOf(UnsafePostbackDestinationError);
  });
});
