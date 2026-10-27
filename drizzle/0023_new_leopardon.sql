ALTER TABLE "questions" ALTER COLUMN "grade" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "grades" varchar(20)[] DEFAULT ARRAY[]::varchar[];--> statement-breakpoint
CREATE INDEX "idx_questions_grades_gin" ON "questions" USING gin ("grades");