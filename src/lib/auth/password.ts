import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt);
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, costValue, blockValue, parallelValue, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || costValue !== String(SCRYPT_COST) || blockValue !== String(SCRYPT_BLOCK_SIZE) || parallelValue !== String(SCRYPT_PARALLELIZATION) || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await scryptAsync(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : undefined;
}

export function validatePassword(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) return "Password must be between 8 and 128 characters.";
  if (!/[A-Z]/.test(value)) return "Password must include at least one uppercase letter.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must include at least one symbol.";
  return undefined;
}
