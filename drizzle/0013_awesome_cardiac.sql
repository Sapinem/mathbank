CREATE INDEX "idx_questions_question_type" ON "questions" USING btree ("question_type");--> statement-breakpoint
CREATE INDEX "idx_media_parent_asset_id" ON "media_assets" USING btree ("parent_asset_id");--> statement-breakpoint
CREATE INDEX "idx_ingest_queue_target_topic" ON "ingest_queue" USING btree ("target_topic_id");