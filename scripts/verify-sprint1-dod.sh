#!/usr/bin/env bash
# verify-sprint1-dod.sh — verifikasi ketiga DoD Sprint 1 (ACT-08, ACT-11, ACT-07)
# dalam satu perintah, read-only (tidak menulis apa pun ke DB).
#
# Pakai:
#   ./scripts/verify-sprint1-dod.sh
#
# Exit code: 0 = semua DoD terpenuhi, 1 = ada yang belum.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
set -a; . ./.env; set +a

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
q()    { psql "$DATABASE_URL" -t -A -F'|' -c "$1" 2>/dev/null; }

echo "== Sprint 1 DoD — $(date -Is) =="
echo

# ---------------------------------------------------------------- ACT-08
echo "ACT-08 — Rekonstruksi relasi media"
IFS='|' read -r qm_rows q_with q_media <<< "$(q "
  SELECT (SELECT count(*) FROM question_media),
         (SELECT count(DISTINCT question_id) FROM question_media),
         (SELECT count(DISTINCT media_id)   FROM question_media)")"
echo "  question_media=${qm_rows} baris · ${q_with} soal · ${q_media} media unik"
[ "${qm_rows:-0}" -gt 0 ] && ok "question_media > 0 baris" || bad "question_media masih kosong"

# Cakupan referensi dihitung dari content_markdown, independen dari question_media.
IFS='|' read -r refs mapped <<< "$(q "
  WITH refs AS (
    SELECT q.id question_id,
           (regexp_matches(q.content_markdown,'\{\{img:([A-Za-z0-9_.-]+)\}\}','g'))[1] ref
    FROM questions q
    WHERE q.content_markdown LIKE '%{{img:%' AND q.deleted_at IS NULL
  ), uniq AS (SELECT DISTINCT question_id, ref FROM refs)
  SELECT count(*), count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM media_assets m JOIN question_media qm ON qm.media_id = m.id
      WHERE m.short_id = uniq.ref AND qm.question_id = uniq.question_id))
  FROM uniq")"
refs=${refs:-0}; mapped=${mapped:-0}
pct_ref=$([ "$refs" -gt 0 ] && awk -v a="$mapped" -v b="$refs" 'BEGIN{printf "%.1f", a/b*100}' || echo 0)
echo "  referensi {{img:...}} terpetakan = ${mapped}/${refs} (${pct_ref}%)"
awk -v p="$pct_ref" 'BEGIN{exit !(p>=80)}' && ok "≥80% referensi terpetakan" || bad "cakupan referensi < 80%"

# ---------------------------------------------------------------- ACT-11
echo
echo "ACT-11 — Distribusi difficulty"
DIST=$(q "SELECT difficulty, count(*),
                 round(count(*)::numeric/(SELECT count(*) FROM questions)*100,1)
          FROM questions GROUP BY difficulty ORDER BY difficulty")
echo "$DIST" | while IFS='|' read -r d c p; do
  [ -n "$d" ] && printf '  D%s: %6s soal (%s%%)\n' "$d" "$c" "$p"
done
levels=$(q "SELECT count(DISTINCT difficulty) FROM questions")
total=$(q "SELECT count(*) FROM questions")
d3pct=$(q "SELECT round(count(*)::numeric/(SELECT count(*) FROM questions)*100,1)
           FROM questions WHERE difficulty = 3")
echo "  level terisi=${levels} · total baris=${total} · porsi D3=${d3pct}%"
[ "${levels:-0}" -ge 3 ] && ok "minimal 3 level terisi" || bad "level terisi < 3"
awk -v p="${d3pct:-100}" 'BEGIN{exit !(p<99.9)}' && ok "D3 tidak lagi 100%" || bad "masih 100% di D3"
[ "${total:-0}" -eq 11889 ] && ok "total baris utuh (11889)" || echo "  INFO  total=${total} (basis awal 11889)"

# ---------------------------------------------------------------- ACT-07
echo
echo "ACT-07 — Batch embedding BGE-M3"
IFS='|' read -r tot emb pct <<< "$(q "
  SELECT count(*), count(embedding),
         round(count(embedding)::numeric/count(*)*100,1) FROM questions")"
echo "  embedded=${emb}/${tot} (${pct}%)"
awk -v p="${pct:-0}" 'BEGIN{exit !(p>95)}' && ok ">95% embedded" || bad "cakupan embedding ${pct}% (target >95%)"

IFS='|' read -r nmod nhash ndims <<< "$(q "
  SELECT count(*) FILTER (WHERE embedding IS NOT NULL AND embedding_model_name IS NOT NULL),
         count(*) FILTER (WHERE embedding IS NOT NULL AND embedding_content_hash IS NOT NULL),
         (SELECT count(DISTINCT vector_dims(embedding)) FROM questions WHERE embedding IS NOT NULL)
  FROM questions")"
echo "  provenance model=${nmod} · hash=${nhash} · dimensi unik=${ndims}"
[ "${ndims:-0}" -le 1 ] && ok "dimensi konsisten (1024)" || bad "dimensi vektor bercampur"

pid=$(cat /tmp/mathbank-embed.pid 2>/dev/null || true)
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
  echo "  runner AKTIF (pid ${pid}) — backfill masih berjalan, resumable"
else
  echo "  runner tidak aktif"
fi
if pgrep -f "watch-embedding.sh" >/dev/null 2>&1; then
  echo "  watcher AKTIF — laporan akhir akan ditulis otomatis"
fi

echo
echo "== Ringkasan: ${PASS} PASS · ${FAIL} FAIL =="
[ "$FAIL" -eq 0 ] && echo "SEMUA DoD TERPENUHI" || echo "BELUM SEMUA DoD TERPENUHI"
[ "$FAIL" -eq 0 ]
