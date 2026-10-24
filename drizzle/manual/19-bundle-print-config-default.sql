-- Penyelarasan default print_config & backfill untuk bundel yang belum memiliki explanationPlacement/answerSpaceCm
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bundles' AND column_name = 'print_config'
  ) THEN
    EXECUTE '
      ALTER TABLE "bundles" ALTER COLUMN "print_config" SET DEFAULT ''{"institutionName":"Math My ID","twoColumnLayout":true,"includeAnswerKey":false,"showQuestionNumber":true,"pageSize":"A4","explanationPlacement":"none","answerSpaceCm":4}''::jsonb;
      UPDATE "bundles"
         SET "print_config" = "print_config" || ''{"explanationPlacement":"none","answerSpaceCm":4}''::jsonb
       WHERE NOT ("print_config" ? ''explanationPlacement'');
    ';
  END IF;
END $$;
