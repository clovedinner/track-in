import { describe, expect, it } from "vitest";

import { formatUsdtAtomic, readIncomingUsdtTransfer, toUsdtAtomicFromCents, TRON_USDT_CONTRACT } from "@/lib/billing/tron";

const walletAddress = "TDmAYs4GfJLo3WHwbduMCRRK22XKsfw3uR";
const validTransfer = {
  transaction_id: "a".repeat(64),
  block_timestamp: 1_797_500_000_000,
  from: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  to: walletAddress,
  type: "Transfer",
  value: "300000001",
  token_info: { address: TRON_USDT_CONTRACT, decimals: 6 },
};

describe("TRON USDT billing helpers", () => {
  it("accepts a confirmed-transfer-shaped incoming USDT row", () => {
    expect(readIncomingUsdtTransfer(validTransfer, walletAddress)?.value).toBe("300000001");
  });

  it("rejects other tokens, wrong destinations, and invalid decimal metadata", () => {
    expect(readIncomingUsdtTransfer({ ...validTransfer, token_info: { address: "other", decimals: 6 } }, walletAddress)).toBeNull();
    expect(readIncomingUsdtTransfer({ ...validTransfer, to: "TWrongAddress" }, walletAddress)).toBeNull();
    expect(readIncomingUsdtTransfer({ ...validTransfer, token_info: { address: TRON_USDT_CONTRACT, decimals: 18 } }, walletAddress)).toBeNull();
  });

  it("converts plan cents to TRC20 USDT base units and formats unique amounts", () => {
    expect(toUsdtAtomicFromCents(BigInt(30_000))).toBe(BigInt(300_000_000));
    expect(formatUsdtAtomic("300000001")).toBe("300.000001");
  });
});
