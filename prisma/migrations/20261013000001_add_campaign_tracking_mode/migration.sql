CREATE TYPE "campaign_tracking_mode" AS ENUM ('redirect', 'direct');

ALTER TABLE "campaigns" ADD COLUMN "tracking_mode" "campaign_tracking_mode" NOT NULL DEFAULT 'redirect';
