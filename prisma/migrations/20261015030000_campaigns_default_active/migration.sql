-- New campaigns are live by default. Existing campaign states are preserved.
ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'active';
