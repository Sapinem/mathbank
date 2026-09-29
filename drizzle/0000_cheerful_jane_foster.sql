CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'status_change', 'restore');--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('question', 'bundle', 'topic', 'source', 'event', 'user', 'setting', 'media', 'tag');--> statement-breakpoint
CREATE TYPE "public"."author_type" AS ENUM('teacher', 'agent', 'machine', 'system');--> statement-breakpoint
CREATE TYPE "public"."bundle_item_role" AS ENUM('question', 'stimulus');--> statement-breakpoint
CREATE TYPE "public"."bundle_type" AS ENUM('source', 'exam', 'exercise');--> statement-breakpoint
CREATE TYPE "public"."cognitive_level" AS ENUM('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');--> statement-breakpoint
CREATE TYPE "public"."ingest_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_origin" AS ENUM('manual_upload', 'pdf_crop', 'ai_generated_tikz', 'ai_generated_svg', 'web_scrape', 'web_ingest', 'tex_import');--> statement-breakpoint
CREATE TYPE "public"."media_role" AS ENUM('content', 'option', 'solution', 'thumbnail');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'review', 'ready', 'archived');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('stimulus', 'single_choice', 'assertion_reason', 'combination_1234', 'quantitative_pq', 'data_sufficiency', 'multiple_choice_checkbox', 'matrix_grid', 'matching', 'short_answer', 'essay');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'teacher', 'reviewer', 'agent', 'machine');--> statement-breakpoint
CREATE TYPE "public"."solution_type" AS ENUM('conceptual', 'quick_tip', 'video', 'alternative');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('book', 'website', 'school', 'competition');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"shortname" varchar(50) NOT NULL,
	"fullname" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"subtests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"color_token" varchar(50) DEFAULT 'event-default' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"isbn" varchar(20),
	"publisher" varchar(255),
	"author" varchar(255),
	"year" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"npsn" varchar(20),
	"level" varchar(20),
	"city" varchar(100),
	"province" varchar(100),
	"address" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "source_kind" NOT NULL,
	"label" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" varchar(10) NOT NULL,
	"content_markdown" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"distractor_rationale" text,
	"order_index" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"child_order" smallint DEFAULT 0 NOT NULL,
	"question_type" "question_type" NOT NULL,
	"difficulty" smallint NOT NULL,
	"cognitive_level" "cognitive_level" NOT NULL,
	"grade" varchar(20) NOT NULL,
	"content_markdown" text NOT NULL,
	"data_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answer_key" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_notes" text,
	"source_id" uuid,
	"event_id" uuid,
	"event_year" smallint,
	"event_subtest" varchar(100),
	"event_item_number" varchar(50),
	"event_notes" text,
	"embedding" vector(1024),
	"embedding_content_hash" varchar(64),
	"embedding_model_name" varchar(100),
	"ai_tagged" boolean DEFAULT false NOT NULL,
	"ai_tagged_at" timestamp with time zone,
	"author_id" text,
	"last_reviewed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"solution_type" "solution_type" DEFAULT 'conceptual' NOT NULL,
	"title" varchar(150) DEFAULT 'Pembahasan Utuh' NOT NULL,
	"content_markdown" text NOT NULL,
	"author_type" "author_type" DEFAULT 'teacher' NOT NULL,
	"author_id" text,
	"ai_model_name" varchar(100),
	"verified_by_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_parent_id_questions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solutions" ADD CONSTRAINT "solutions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_events_code" ON "events" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_events_category" ON "events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_events_is_active" ON "events" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_books_source" ON "books" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_institutions_source" ON "institutions" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_institutions_city" ON "institutions" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_institutions_npsn" ON "institutions" USING btree ("npsn");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sources_slug" ON "sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_sources_kind" ON "sources" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_sources_is_active" ON "sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_question_options_question" ON "question_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_questions_parent_id" ON "questions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_questions_status" ON "questions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_questions_grade" ON "questions" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "idx_questions_difficulty" ON "questions" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "idx_questions_source_id" ON "questions" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_questions_event_id" ON "questions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_questions_author_id" ON "questions" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_questions_deleted_at" ON "questions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_questions_grade_diff_status" ON "questions" USING btree ("grade","difficulty","status");--> statement-breakpoint
CREATE INDEX "idx_questions_content_trgm" ON "questions" USING gin ("content_markdown" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_solutions_question" ON "solutions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_solutions_primary" ON "solutions" USING btree ("question_id","is_primary");