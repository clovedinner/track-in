CREATE TABLE "audit_entries" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "action" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" uuid NOT NULL,
    "actor" text NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}',
    "correlation_id" uuid NOT NULL,
    "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_entries_entity_type_entity_id_created_at_idx"
ON "audit_entries"("entity_type", "entity_id", "created_at" DESC);

CREATE INDEX "audit_entries_created_at_idx"
ON "audit_entries"("created_at" DESC);
