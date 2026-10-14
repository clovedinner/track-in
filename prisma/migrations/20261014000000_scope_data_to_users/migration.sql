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

-- Existing single-account data can contain duplicate names. Preserve every
-- record while making names unique within the owning account.
DO $$
DECLARE
  duplicate_record RECORD;
  candidate_name TEXT;
  suffix INTEGER;
BEGIN
  FOR duplicate_record IN
    SELECT "id", "owner_id", "name",
           ROW_NUMBER() OVER (
             PARTITION BY "owner_id", "name"
             ORDER BY "created_at", "id"
           ) AS duplicate_number
    FROM "offers"
  LOOP
    IF duplicate_record.duplicate_number > 1 THEN
      suffix := duplicate_record.duplicate_number;
      candidate_name := duplicate_record.name || ' (' || suffix || ')';
      WHILE EXISTS (
        SELECT 1 FROM "offers"
        WHERE "owner_id" = duplicate_record.owner_id
          AND "name" = candidate_name
      ) LOOP
        suffix := suffix + 1;
        candidate_name := duplicate_record.name || ' (' || suffix || ')';
      END LOOP;
      UPDATE "offers"
      SET "name" = candidate_name
      WHERE "id" = duplicate_record.id;
    END IF;
  END LOOP;

  FOR duplicate_record IN
    SELECT "id", "owner_id", "name",
           ROW_NUMBER() OVER (
             PARTITION BY "owner_id", lower("name")
             ORDER BY "created_at", "id"
           ) AS duplicate_number
    FROM "traffic_sources"
  LOOP
    IF duplicate_record.duplicate_number > 1 THEN
      suffix := duplicate_record.duplicate_number;
      candidate_name := duplicate_record.name || ' (' || suffix || ')';
      WHILE EXISTS (
        SELECT 1 FROM "traffic_sources"
        WHERE "owner_id" = duplicate_record.owner_id
          AND lower("name") = lower(candidate_name)
      ) LOOP
        suffix := suffix + 1;
        candidate_name := duplicate_record.name || ' (' || suffix || ')';
      END LOOP;
      UPDATE "traffic_sources"
      SET "name" = candidate_name
      WHERE "id" = duplicate_record.id;
    END IF;
  END LOOP;
END $$;

DROP INDEX IF EXISTS "traffic_sources_name_lower_unique";
CREATE UNIQUE INDEX "offers_owner_id_name_key" ON "offers"("owner_id", "name");
CREATE UNIQUE INDEX "traffic_sources_owner_id_name_key" ON "traffic_sources"("owner_id", lower("name"));
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns"("owner_id");
CREATE INDEX "offers_owner_id_idx" ON "offers"("owner_id");
CREATE INDEX "traffic_sources_owner_id_idx" ON "traffic_sources"("owner_id");
