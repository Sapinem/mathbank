-- 20-denormalize-grades.sql
-- Idempotent: migrasi nilai grade di bundles & questions, serta sinkronisasi denormalisasi grades

-- 1. Hapus entri non-kelas dari master grades
DELETE FROM grades WHERE id IN ('utbk', 'mandiri', 'umum', '11w', '11l', '12w', '12l');

-- 2. Update bundle.grade yang masih 'umum' atau NULL tapi soal-soalnya memiliki grade riil
WITH bundle_dominant_grade AS (
  SELECT
    bi.bundle_id,
    q.grade,
    ROW_NUMBER() OVER (PARTITION BY bi.bundle_id ORDER BY count(*) DESC) as rn
  FROM bundle_items bi
  JOIN questions q ON bi.question_id = q.id
  WHERE q.grade IS NOT NULL AND q.grade <> 'umum'
  GROUP BY bi.bundle_id, q.grade
)
UPDATE bundles b
SET grade = bdg.grade
FROM bundle_dominant_grade bdg
WHERE b.id = bdg.bundle_id
  AND bdg.rn = 1
  AND b.grade = 'umum'
  AND b.status <> 'archived'
  AND b.deleted_at IS NULL;

-- 3. Untuk bundle yang tersisa dengan 'umum', netralkan ke NULL
UPDATE bundles SET grade = NULL WHERE grade = 'umum' AND status <> 'archived' AND deleted_at IS NULL;

-- 4. Netralkan questions.grade yang 'umum' ke NULL
UPDATE questions SET grade = NULL WHERE grade = 'umum';

-- 5. Hitung agregat grade per soal dari bundles secara cepat (direct update dari CTE agregat tanpa self-join)
WITH question_grade_agg AS (
  SELECT
    bi.question_id,
    ARRAY_AGG(DISTINCT b.grade ORDER BY b.grade) AS bundle_grades,
    (ARRAY_AGG(DISTINCT b.grade ORDER BY b.grade))[1] AS first_grade
  FROM bundle_items bi
  JOIN bundles b ON bi.bundle_id = b.id
  WHERE b.deleted_at IS NULL
    AND b.status <> 'archived'
    AND b.grade IS NOT NULL
    AND b.grade <> ''
    AND b.grade <> 'umum'
  GROUP BY bi.question_id
)
UPDATE questions q
SET
  grades = qga.bundle_grades,
  grade = COALESCE(qga.first_grade, q.grade)
FROM question_grade_agg qga
WHERE q.id = qga.question_id
  AND (
    q.grades IS DISTINCT FROM qga.bundle_grades
    OR q.grade IS DISTINCT FROM COALESCE(qga.first_grade, q.grade)
  );

-- 6. Untuk soal mandiri yang tidak tergabung dalam bundle aktif, pastikan grades terisi dari grade tunggal
UPDATE questions
SET grades = ARRAY[grade]::varchar[]
WHERE grade IS NOT NULL
  AND (grades IS NULL OR grades = '{}'::varchar[]);
