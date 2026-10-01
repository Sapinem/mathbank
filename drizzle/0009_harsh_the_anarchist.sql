ALTER TABLE "books" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "institutions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "books" CASCADE;--> statement-breakpoint
DROP TABLE "institutions" CASCADE;--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "question_sources" ALTER COLUMN "source_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "question_sources" ALTER COLUMN "source_type" SET DEFAULT 'website'::text;--> statement-breakpoint
DROP TYPE "public"."source_kind";--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('book', 'website', 'school');--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "kind" SET DATA TYPE "public"."source_kind" USING "kind"::"public"."source_kind";--> statement-breakpoint
ALTER TABLE "question_sources" ALTER COLUMN "source_type" SET DEFAULT 'website'::"public"."source_kind";--> statement-breakpoint
ALTER TABLE "question_sources" ALTER COLUMN "source_type" SET DATA TYPE "public"."source_kind" USING "source_type"::"public"."source_kind";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "publisher" varchar(255);--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "author" varchar(255);--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "book_year" smallint;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "city" varchar(100);--> statement-breakpoint
CREATE INDEX "idx_sources_city" ON "sources" USING btree ("city");
