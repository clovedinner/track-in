ALTER TABLE "billing_payments"
ADD COLUMN "plan" TEXT;

-- Payments created before plan persistence was introduced are retained. There
-- should normally be none because invoice creation was unavailable, but use a
-- deterministic fallback before enforcing the required field.
UPDATE "billing_payments"
SET "plan" = 'Starter'
WHERE "plan" IS NULL;

ALTER TABLE "billing_payments"
ALTER COLUMN "plan" SET NOT NULL;
