ALTER TABLE "billing_payments"
ADD COLUMN "payment_amount_atomic" BIGINT;

CREATE UNIQUE INDEX "billing_payments_payment_amount_atomic_key"
ON "billing_payments"("payment_amount_atomic");

CREATE TABLE "billing_chain_checkpoints" (
  "id" TEXT NOT NULL,
  "last_scanned_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_chain_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_chain_transfers" (
  "id" TEXT NOT NULL,
  "transaction_hash" TEXT NOT NULL,
  "amount_atomic" BIGINT NOT NULL,
  "from_address" TEXT NOT NULL,
  "to_address" TEXT NOT NULL,
  "block_timestamp" TIMESTAMPTZ(6) NOT NULL,
  "payment_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_chain_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_chain_transfers_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "billing_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "billing_chain_transfers_amount_atomic_idx" ON "billing_chain_transfers"("amount_atomic");
CREATE INDEX "billing_chain_transfers_block_timestamp_idx" ON "billing_chain_transfers"("block_timestamp");
CREATE INDEX "billing_chain_transfers_payment_id_idx" ON "billing_chain_transfers"("payment_id");
