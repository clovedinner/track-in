import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export class UnsafePostbackDestinationError extends Error {
  constructor() { super("Postback destination must resolve only to public internet addresses."); }
}

export function isPublicPostbackAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a !== 0 && a !== 10 && a !== 127 && a < 224
      && !(a === 100 && b >= 64 && b <= 127)
      && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31)
      && !(a === 192 && [0, 2, 168].includes(b)) && !(a === 198 && [18, 19, 51].includes(b))
      && !(a === 203 && b === 0);
  }
  // Only global-unicast IPv6; exclude transition mechanisms and documentation ranges.
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address)
    && !/^2001:(?:0*:|db8:|[12][0-9a-f]:)/i.test(address) && !/^2002:/i.test(address);
  return false;
}

export type PostbackTransport = (request: { url: string; method: "GET"; headers: { accept: "*/*" } }) => Promise<{ status: number }>;

export const sendPublicPostback: PostbackTransport = async (input) => {
  const url = new URL(input.url);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new UnsafePostbackDestinationError();
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  // The deadline covers both DNS resolution and the complete outbound request.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let rejectLookup: (() => void) | undefined;
  try {
    const addresses = await Promise.race([
      isIP(hostname) ? Promise.resolve([{ address: hostname, family: isIP(hostname) }]) : lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        rejectLookup = () => reject(new Error("Postback request timed out."));
        controller.signal.addEventListener("abort", rejectLookup, { once: true });
      }),
    ]);
    if (!addresses.length || addresses.some(({ address }) => !isPublicPostbackAddress(address))) throw new UnsafePostbackDestinationError();
    const pinned = addresses[0];
    return await new Promise<{ status: number }>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
        method: input.method,
        headers: input.headers,
        signal: controller.signal,
        // Pin the validated result; another DNS lookup would permit rebinding.
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      }, (response) => {
        resolve({ status: response.statusCode ?? 502 });
        response.destroy();
      });
      request.on("error", reject);
      request.end();
    });
  } finally {
    clearTimeout(timeout);
    if (rejectLookup) controller.signal.removeEventListener("abort", rejectLookup);
  }
};
