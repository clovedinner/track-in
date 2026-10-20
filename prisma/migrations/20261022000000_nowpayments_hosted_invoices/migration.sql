ALTER TABLE "billing_payments"
ADD COLUMN "provider_invoice_id" TEXT,
ADD COLUMN "checkout_url" TEXT;

CREATE INDEX "billing_payments_provider_invoice_id_idx"
ON "billing_payments"("provider_invoice_id");
