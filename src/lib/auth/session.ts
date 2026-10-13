const SESSION_COOKIE = "trakio_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type SessionPayload = { userId: string; email: string; exp: number };

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.CONVERSION_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be at least 32 characters.");
  return secret;
}

function toBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-trakio_session" : SESSION_COOKIE;
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE };
}

export async function createSessionToken(user: { id: string; email: string }): Promise<string> {
  const payload: SessionPayload = { userId: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = await sign(encoded);
  if (expected.length !== signature.length) return null;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (difference !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as SessionPayload;
    return typeof payload.userId === "string" && typeof payload.email === "string" && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
