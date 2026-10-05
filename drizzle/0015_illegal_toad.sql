CREATE INDEX "idx_bundles_deleted_updated" ON "bundles" USING btree ("deleted_at","updated_at");--> statement-breakpoint
CREATE INDEX "idx_questions_cognitive_level" ON "questions" USING btree ("cognitive_level");--> statement-breakpoint
CREATE INDEX "idx_media_created_at" ON "media_assets" USING btree ("created_at");