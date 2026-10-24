#!/usr/bin/env bash
# start-embedding.sh — jalankan backfill embedding (ACT-07) + watcher-nya di background.
#
# Dipakai supaya peluncuran proses latar konsisten & tidak bergantung pada
# sintaks shell ad-hoc (nohup/&) yang mudah salah saat disalin.
#
# Pakai:
#   ./scripts/start-embedding.sh              # batch 32, delay 50ms, 1 worker
#   BATCH=24 DELAY=100 ./scripts/start-embedding.sh
#   WORKERS=2 ./scripts/start-embedding.sh    # paralel (lihat catatan di bawah)
#
# Catatan performa (terukur Sprint 1, mesin 8 core / RAM 8 GB + swap):
#   - Batch 32 diurutkan `ORDER BY length(content_markdown)` = 0,93 s/soal.
#     Urut id (panjang acak) = 2,25 s/soal, karena padding ke sekuens
#     terpanjang dalam batch. Jadi pengurutan panjang ~2,4x lebih cepat.
#   - 2 worker paralel TIDAK membantu: service CPU-bound + mesin sudah
#     menukar (swap) sehingga tiap request saling memperlambat
#     (terukur 37 s/soal saat uji 2 worker). Default tetap 1 worker.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

BATCH="${BATCH:-32}"
DELAY="${DELAY:-50}"
WORKERS="${WORKERS:-1}"
TODAY="$(date +%F)"
LOG="logs/embedding-${TODAY}.log"
STDOUT_LOG="logs/embedding-stdout-${TODAY}.log"
PID_FILE=/tmp/mathbank-embed.pid

mkdir -p logs docs/sprint1

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
  echo "sudah berjalan (pid $(cat "$PID_FILE")) — tidak meluncurkan worker baru."
  exit 0
fi

if [ "$WORKERS" -gt 1 ]; then
  for i in $(seq 0 $((WORKERS - 1))); do
    nohup pnpm tsx scripts/batch-embed-questions.ts \
      --batch "$BATCH" --delay "$DELAY" --shard "${i}/${WORKERS}" \
      >> "$STDOUT_LOG" 2>&1 &
    echo $! > "/tmp/mathbank-embed-${i}of${WORKERS}.pid"
    echo "worker shard ${i}/${WORKERS} pid $!"
  done
else
  nohup pnpm tsx scripts/batch-embed-questions.ts \
    --batch "$BATCH" --delay "$DELAY" \
    >> "$STDOUT_LOG" 2>&1 &
  echo $! > "$PID_FILE"
  echo "runner pid $(cat "$PID_FILE") · log $LOG"
fi

# Watcher: menulis laporan akhir + self-wake tiket saat backfill tuntas.
if ! pgrep -f "scripts/watch-embedding.sh" >/dev/null 2>&1; then
  INTERVAL="${INTERVAL:-180}" nohup bash scripts/watch-embedding.sh \
    >> "logs/embedding-watch-stdout-${TODAY}.log" 2>&1 &
  echo "watcher pid $! (interval ${INTERVAL:-180}s)"
else
  echo "watcher sudah berjalan."
fi
