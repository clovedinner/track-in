
import { createHash } from "node:crypto";

export const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const TRON_USDT_DECIMALS = 6;
export const TRON_PAYMENT_PROVIDER = "tron";
export const MAX_INVOICE_REFERENCE_ATOMIC = BigInt(100_000);

export type TronTransfer = {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string;
  token_info: { address: string; decimals: number };
  event_index?: number;
};

export function readIncomingUsdtTransfer(value: unknown, walletAddress: string): TronTransfer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const transfer = value as Record<string, unknown>;
  const tokenInfo = transfer.token_info;
  if (!tokenInfo || typeof tokenInfo !== "object" || Array.isArray(tokenInfo)) return null;
  const token = tokenInfo as Record<string, unknown>;
  if (
    transfer.type !== "Transfer" ||
    transfer.to !== walletAddress ||
    typeof transfer.from !== "string" ||
    !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(transfer.from) ||
    typeof transfer.transaction_id !== "string" ||
    !/^[a-f\d]{64}$/i.test(transfer.transaction_id) ||
    typeof transfer.value !== "string" ||
    !/^\d{1,78}$/.test(transfer.value) ||
    typeof transfer.block_timestamp !== "number" ||
    !Number.isSafeInteger(transfer.block_timestamp) ||
    transfer.block_timestamp < 0 ||
    token.address !== TRON_USDT_CONTRACT ||
    token.decimals !== TRON_USDT_DECIMALS
  ) return null;
  const eventIndex = transfer.event_index;
  return {
    transaction_id: transfer.transaction_id,
    block_timestamp: transfer.block_timestamp,
    from: transfer.from,
    to: walletAddress,
    type: "Transfer",
    value: transfer.value,
    token_info: { address: TRON_USDT_CONTRACT, decimals: TRON_USDT_DECIMALS },
    ...(typeof eventIndex === "number" && Number.isSafeInteger(eventIndex) && eventIndex >= 0 ? { event_index: eventIndex } : {}),
  };
}

export function formatUsdtAtomic(value: string | bigint): string {
  const atomic = typeof value === "bigint" ? value : BigInt(value);
  const scale = BigInt(10) ** BigInt(TRON_USDT_DECIMALS);
  const whole = atomic / scale;
  const fraction = (atomic % scale).toString().padStart(TRON_USDT_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

export function toUsdtAtomicFromCents(amountMinor: bigint): bigint {
  return amountMinor * BigInt(10_000);
}

export function createTronEventId(transfer: TronTransfer): string {
  const identity = `${transfer.transaction_id}:${transfer.event_index ?? `${transfer.from}:${transfer.value}`}`;
  return createHash("sha256").update(identity).digest("hex");
}

