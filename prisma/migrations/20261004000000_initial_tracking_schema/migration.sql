CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."outbound_postback_status" AS ENUM('pending', 'processing', 'delivered', 'retryable_failed', 'permanently_failed', 'suppressed');
--> statement-breakpoint
CREATE TABLE "traffic_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "credential_secret_ref" text,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "retry_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "traffic_sources_configuration_object" CHECK (jsonb_typeof("configuration") = 'object'),
  CONSTRAINT "traffic_sources_retry_policy_object" CHECK (jsonb_typeof("retry_policy") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_sources_name_lower_unique" ON "traffic_sources" USING btree (lower("name"));
--> statement-breakpoint
CREATE TABLE "campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "status" "campaign_status" DEFAULT 'paused' NOT NULL,
  "destination_url" text NOT NULL,
  "traffic_source_id" uuid,
  "default_currency" char(3) NOT NULL,
  "allowed_tracking_parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "campaigns_currency_uppercase" CHECK ("default_currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "campaigns_allowed_parameters_array" CHECK (jsonb_typeof("allowed_tracking_parameters") = 'array')
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_traffic_source_id_traffic_sources_id_fk" FOREIGN KEY ("traffic_source_id") REFERENCES "public"."traffic_sources"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_slug_lower_unique" ON "campaigns" USING btree (lower("slug"));
--> statement-breakpoint
CREATE INDEX "campaigns_traffic_source_id_idx" ON "campaigns" USING btree ("traffic_source_id");
--> statement-breakpoint
CREATE TABLE "clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "click_id" text NOT NULL,
  "campaign_id" uuid NOT NULL,
  "traffic_source_id" uuid,
  "clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "referrer" text,
  "destination_url" text NOT NULL,
  "tracking_tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "correlation_id" uuid NOT NULL,
  CONSTRAINT "clicks_click_id_unique" UNIQUE("click_id"),
  CONSTRAINT "clicks_tracking_tokens_object" CHECK (jsonb_typeof("tracking_tokens") = 'object')
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_traffic_source_id_traffic_sources_id_fk" FOREIGN KEY ("traffic_source_id") REFERENCES "public"."traffic_sources"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "clicks_campaign_clicked_at_idx" ON "clicks" USING btree ("campaign_id", "clicked_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "clicks_traffic_source_clicked_at_idx" ON "clicks" USING btree ("traffic_source_id", "clicked_at" DESC NULLS LAST) WHERE "traffic_source_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "conversions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "click_record_id" uuid NOT NULL,
  "source" text NOT NULL,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "value_minor" bigint NOT NULL,
  "currency" char(3) NOT NULL,
  "transaction_reference" text,
  "payload_hash" char(64) NOT NULL,
  "validation_state" text DEFAULT 'accepted' NOT NULL,
  "correlation_id" uuid NOT NULL,
  CONSTRAINT "conversions_source_event_id_unique" UNIQUE("source", "event_id"),
  CONSTRAINT "conversions_value_minor_nonnegative" CHECK ("value_minor" >= 0),
  CONSTRAINT "conversions_currency_uppercase" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "conversions_payload_hash_hex" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_click_record_id_clicks_id_fk" FOREIGN KEY ("click_record_id") REFERENCES "public"."clicks"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conversions_click_record_id_idx" ON "conversions" USING btree ("click_record_id");
--> statement-breakpoint
CREATE INDEX "conversions_received_at_idx" ON "conversions" USING btree ("received_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "conversions_occurred_at_idx" ON "conversions" USING btree ("occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE TABLE "outbound_postbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversion_id" uuid NOT NULL,
  "traffic_source_id" uuid NOT NULL,
  "destination" text NOT NULL,
  "status" "outbound_postback_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "request_fingerprint" char(64),
  "last_response_status" integer,
  "last_response_summary" text,
  "last_error" text,
  "delivered_at" timestamp with time zone,
  "correlation_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "outbound_postbacks_conversion_source_destination_unique" UNIQUE("conversion_id", "traffic_source_id", "destination"),
  CONSTRAINT "outbound_postbacks_attempt_count_nonnegative" CHECK ("attempt_count" >= 0),
  CONSTRAINT "outbound_postbacks_response_status_range" CHECK ("last_response_status" IS NULL OR "last_response_status" BETWEEN 100 AND 599),
  CONSTRAINT "outbound_postbacks_request_fingerprint_hex" CHECK ("request_fingerprint" IS NULL OR "request_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "outbound_postbacks" ADD CONSTRAINT "outbound_postbacks_conversion_id_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."conversions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outbound_postbacks" ADD CONSTRAINT "outbound_postbacks_traffic_source_id_traffic_sources_id_fk" FOREIGN KEY ("traffic_source_id") REFERENCES "public"."traffic_sources"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "outbound_postbacks_conversion_id_idx" ON "outbound_postbacks" USING btree ("conversion_id");
--> statement-breakpoint
CREATE INDEX "outbound_postbacks_due_idx" ON "outbound_postbacks" USING btree ("status", "next_attempt_at") WHERE "status" IN ('pending', 'retryable_failed');
