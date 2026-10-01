CREATE TABLE "question_sources" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"question_id" uuid NOT NULL,
	"source_id" uuid,
	"source_type" "source_kind" DEFAULT 'website' NOT NULL,
	"title" varchar(255),
	"url" text,
	"accessed_at" timestamp with time zone,
	"publisher" varchar(255),
	"author" varchar(255),
	"year" smallint,
	"grade" varchar(20),
	"item_number" varchar(50),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_question_sources_question" ON "question_sources" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_question_sources_source" ON "question_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_question_sources_type" ON "question_sources" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_question_sources_question_source" ON "question_sources" USING btree ("question_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_questions_content_hash" ON "questions" USING btree ("content_hash") WHERE "questions"."deleted_at" IS NULL AND "questions"."content_hash" IS NOT NULL;