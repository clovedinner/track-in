CREATE TABLE "custom_conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "event_values" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "include_in_conversions" BOOLEAN NOT NULL DEFAULT true,
    "include_in_revenue" BOOLEAN NOT NULL DEFAULT false,
    "send_postback_to_traffic_source" BOOLEAN NOT NULL DEFAULT false,
    "include_in_cost" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_conversions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_conversions_owner_id_created_at_idx"
    ON "custom_conversions"("owner_id", "created_at" DESC);

CREATE UNIQUE INDEX "custom_conversions_owner_id_name_key"
    ON "custom_conversions"("owner_id", "name");

ALTER TABLE "custom_conversions"
    ADD CONSTRAINT "custom_conversions_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
