#!/usr/bin/env bash
# watch-embedding.sh — pemantau backfill embedding BGE-M3 (ACT-07).
#
# Menemani `scripts/batch-embed-questions.ts` yang berjalan di background:
#   - tiap INTERVAL detik mencatat cakupan embedding ke logs/embedding-watch.log
#   - saat proses runner selesai (PID hilang) menulis laporan akhir
#     docs/sprint1/ACT-07-EMBEDDING-REPORT.md
#
# Pakai:
#   ./scripts/watch-embedding.sh            # interval 600 dtk
#   INTERVAL=60 ./scripts/watch-embedding.sh
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
set -a; . ./.env; set +a

INTERVAL="${INTERVAL:-600}"
PID_FILE=/tmp/mathbank-embed.pid
WATCH_LOG="logs/embedding-watch-$(date +%F).log"
REPORT="docs/sprint1/ACT-07-EMBEDDING-REPORT.md"
mkdir -p logs docs/sprint1

q() { psql "$DATABASE_URL" -t -A -F'|' -c "$1" 2>/dev/null; }

coverage() {
  q "SELECT count(*) FILTER (WHERE embedding IS NOT NULL), count(*),
            round(count(embedding)::numeric / count(*) * 100, 1)
       FROM questions WHERE deleted_at IS NULL"
}

echo "[$(date -Is)] watcher mulai (interval ${INTERVAL}s, pid_file ${PID_FILE})" >> "$WATCH_LOG"

while true; do
  cov=$(coverage)
  emb=${cov%%|*}; rest=${cov#*|}; tot=${rest%%|*}; pct=${rest#*|}
  echo "[$(date -Is)] embedded=${emb}/${tot} (${pct}%)" >> "$WATCH_LOG"

  pid=$(cat "$PID_FILE" 2>/dev/null || true)
  running=0
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && running=1

  # Selesai: runner mati DAN cakupan sudah tinggi (atau tak ada sisa).
  if [ "$running" -eq 0 ]; then
    sisa=$(q "SELECT count(*) FROM questions WHERE embedding IS NULL AND deleted_at IS NULL")
    if [ "${sisa:-0}" -eq 0 ] || [ "${pct%.*}" -ge 95 ]; then
      err_count=$(grep -c "GAGAL" "logs/embedding-errors-$(date +%F).log" 2>/dev/null || echo 0)
      cat > "$REPORT" <<MD
# ACT-07 — Laporan Akhir Backfill Embedding BGE-M3

**Dibuat otomatis oleh** \`scripts/watch-embedding.sh\` pada $(date -Is)

| Metrik | Nilai |
| --- | --- |
| Total soal aktif | ${tot} |
| Memiliki embedding | ${emb} |
| Cakupan | **${pct}%** |
| Sisa tanpa embedding | ${sisa} |
| Soal gagal (error log) | ${err_count} |

Ambang DoD: **> 95% embedded** → $( [ "${pct%.*}" -ge 95 ] && echo "TERPENUHI" || echo "BELUM TERPENUHI" ).

Verifikasi ulang:

\`\`\`sql
SELECT count(*) AS total, count(embedding) AS embedded,
       round(count(embedding)::numeric / count(*) * 100, 1) AS pct_embedded
FROM questions;
\`\`\`

Log proses: \`logs/embedding-$(date +%F).log\` ·
Error per soal: \`logs/embedding-errors-$(date +%F).log\` ·
Pantauan: \`${WATCH_LOG}\`
MD
      echo "[$(date -Is)] runner selesai — laporan ditulis ke ${REPORT}" >> "$WATCH_LOG"
      exit 0
    fi
  fi

  sleep "$INTERVAL"
done
