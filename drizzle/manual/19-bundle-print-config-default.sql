-- Penyelarasan default print_config & backfill untuk bundel yang belum memiliki explanationPlacement/answerSpaceCm/backgroundWatermark
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bundles' AND column_name = 'print_config'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE "bundles" ALTER COLUMN "print_config" SET DEFAULT '{"institutionName":"Math My ID","twoColumnLayout":true,"includeAnswerKey":false,"showQuestionNumber":true,"pageSize":"A4","explanationPlacement":"none","answerSpaceCm":3,"backgroundGrid":false,"backgroundWatermark":true,"columnBreaks":[],"brandColor":"#0158ca"}'::jsonb;
      -- Urutan merge PENTING: default di KIRI, nilai lama di KANAN.
      -- jsonb || membuat operand kanan menang, jadi 'print_config || default'
      -- akan MENIMPA brandColor/columnBreaks yang sudah dikustomisasi guru
      -- pada baris yang sekadar belum punya backgroundWatermark.
      UPDATE "bundles"
         SET "print_config" = '{"backgroundGrid":false,"backgroundWatermark":true,"columnBreaks":[],"brandColor":"#0158ca"}'::jsonb || "print_config"
       WHERE NOT ("print_config" ? 'backgroundWatermark');
    $sql$;
  END IF;
END $$;
