CREATE TYPE "account_status" AS ENUM ('payment_required', 'active', 'past_due', 'suspended', 'canceled');
CREATE TYPE "subscription_status" AS ENUM ('active', 'past_due', 'canceled', 'expired');
CREATE TYPE "billing_payment_status" AS ENUM ('pending', 'confirmed', 'failed', 'refunded');

ALTER TABLE "users"
ADD COLUMN "account_status" "account_status" NOT NULL DEFAULT 'payment_required';

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "plan" TEXT NOT NULL,
  "status" "subscription_status" NOT NULL DEFAULT 'active',
  "provider" TEXT NOT NULL,
  "external_id" TEXT,
  "current_period_start" TIMESTAMPTZ(6) NOT NULL,
  "current_period_end" TIMESTAMPTZ(6),
  "next_invoice_at" TIMESTAMPTZ(6),
  "canceled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "billing_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "subscription_id" UUID,
  "invoice_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "network" TEXT,
  "status" "billing_payment_status" NOT NULL DEFAULT 'pending',
  "provider_transaction_id" TEXT,
  "transaction_hash" TEXT,
  "received_at" TIMESTAMPTZ(6),
  "confirmed_at" TIMESTAMPTZ(6),
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "billing_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "provider" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subscriptions_provider_external_id_key" ON "subscriptions"("provider", "external_id");
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");
CREATE UNIQUE INDEX "billing_payments_invoice_id_key" ON "billing_payments"("invoice_id");
CREATE INDEX "billing_payments_user_id_status_idx" ON "billing_payments"("user_id", "status");
CREATE INDEX "billing_payments_provider_transaction_id_idx" ON "billing_payments"("provider_transaction_id");
CREATE INDEX "billing_payments_transaction_hash_idx" ON "billing_payments"("transaction_hash");
CREATE UNIQUE INDEX "billing_events_provider_event_id_key" ON "billing_events"("provider", "event_id");
CREATE INDEX "billing_events_user_id_created_at_idx" ON "billing_events"("user_id", "created_at" DESC);

UPDATE "users"
SET "account_status" = 'active'
WHERE lower("email") IN ('trakioads@gmail.com', 'admin@trakio.org');

INSERT INTO "subscriptions" (
  "user_id", "plan", "status", "provider", "current_period_start", "current_period_end", "next_invoice_at"
)
SELECT "id", 'Expanded', 'active', 'manual', CURRENT_TIMESTAMP, NULL, NULL
FROM "users"
WHERE lower("email") IN ('trakioads@gmail.com', 'admin@trakio.org')
  AND NOT EXISTS (
    SELECT 1 FROM "subscriptions" existing
    WHERE existing."user_id" = "users"."id"
      AND existing."status" = 'active'
  );
