-- MAT-35 R5 JSONB: Migrate answer_key.text -> answer_key.scoringRubric
-- Per MAT-144 architecture: scoringRubric is the canonical field in answer_key
-- Run: sudo -u postgres psql -p 5433 -d mathbank -f scripts/r5-migrate-rubric-field.sql

BEGIN;

-- Step 1: Copy answer_key.text -> answer_key.scoringRubric for existing rubrics
-- Only migrate where scoringRubric is not yet set
UPDATE questions
SET answer_key = jsonb_set(
  answer_key,
  '{scoringRubric}',
  answer_key->'text'
)
WHERE question_type = 'essay'
  AND deleted_at IS NULL
  AND answer_key ? 'text'
  AND (answer_key->>'text') IS NOT NULL
  AND trim(answer_key->>'text') != ''
  AND (answer_key->>'scoringRubric' IS NULL OR trim(answer_key->>'scoringRubric') = '');

-- Report
SELECT 
  COUNT(*) FILTER (WHERE answer_key->>'scoringRubric' IS NOT NULL AND trim(answer_key->>'scoringRubric') != '') as now_with_scoring_rubric,
  COUNT(*) FILTER (WHERE answer_key->>'text' IS NOT NULL) as still_with_text
FROM questions WHERE question_type = 'essay' AND deleted_at IS NULL;

COMMIT;
