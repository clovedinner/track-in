ALTER TABLE "billing_payments"
ALTER COLUMN "currency" TYPE VARCHAR(10)
USING rtrim("currency");
