ALTER TYPE "public"."audit_entity" ADD VALUE 'collection' BEFORE 'topic';--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"collection_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"order_index" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"source_id" uuid,
	"event_id" uuid,
	"year" smallint,
	"grade" varchar(20),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_collection_items_pair" ON "collection_items" USING btree ("collection_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_collection_items_collection" ON "collection_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_collection_items_question" ON "collection_items" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_collections_slug" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_collections_source_id" ON "collections" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_collections_event_id" ON "collections" USING btree ("event_id");