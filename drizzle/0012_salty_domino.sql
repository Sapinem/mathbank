ALTER TABLE "bundles" ALTER COLUMN "bundle_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."bundle_type";--> statement-breakpoint
CREATE TYPE "public"."bundle_type" AS ENUM('source', 'exam');--> statement-breakpoint
ALTER TABLE "bundles" ALTER COLUMN "bundle_type" SET DATA TYPE "public"."bundle_type" USING "bundle_type"::"public"."bundle_type";