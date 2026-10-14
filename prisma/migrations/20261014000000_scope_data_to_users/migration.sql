ALTER TABLE "campaigns" ADD COLUMN "owner_id" UUID;
ALTER TABLE "offers" ADD COLUMN "owner_id" UUID;
ALTER TABLE "traffic_sources" ADD COLUMN "owner_id" UUID;

DO $$
DECLARE
  fallback_user UUID;
BEGIN
  SELECT "id" INTO fallback_user FROM "users" ORDER BY "created_at" ASC LIMIT 1;
  IF fallback_user IS NOT NULL THEN
    UPDATE "campaigns" SET "owner_id" = fallback_user WHERE "owner_id" IS NULL;
    UPDATE "offers" SET "owner_id" = fallback_user WHERE "owner_id" IS NULL;
    UPDATE "traffic_sources" SET "owner_id" = fallback_user WHERE "owner_id" IS NULL;
  END IF;
END $$;

ALTER TABLE "campaigns" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "offers" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "traffic_sources" ALTER COLUMN "owner_id" SET NOT NULL;

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traffic_sources" ADD CONSTRAINT "traffic_sources_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "traffic_sources_name_lower_unique";
CREATE UNIQUE INDEX "campaigns_slug_lower_unique" ON "campaigns"(lower("slug"));
CREATE UNIQUE INDEX "offers_owner_id_name_key" ON "offers"("owner_id", "name");
CREATE UNIQUE INDEX "traffic_sources_owner_id_name_key" ON "traffic_sources"("owner_id", lower("name"));
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns"("owner_id");
CREATE INDEX "offers_owner_id_idx" ON "offers"("owner_id");
CREATE INDEX "traffic_sources_owner_id_idx" ON "traffic_sources"("owner_id");
