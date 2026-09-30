DROP INDEX "idx_apikey_key";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_apikey_key" ON "apikey" USING btree ("key");