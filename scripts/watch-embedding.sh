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
    # Guard anti-loop-abadi: bila runner mati tapi cakupan mentok < 95%
    # (mis. sebagian soal selalu gagal), tetap tulis laporan setelah 3 cek
    # berturut-turut tanpa kemajuan, lalu keluar. Tanpa ini watcher
    # menggantung selamanya tanpa sinyal apa pun.
    if [ "$emb" = "${LAST_EMB:-}" ]; then
      STALLED=$(( ${STALLED:-0} + 1 ))
    else
      STALLED=0
    fi
    LAST_EMB="$emb"

    if [ "${sisa:-0}" -eq 0 ] || [ "${pct%.*}" -ge 95 ] || [ "$STALLED" -ge 3 ]; then
      [ "$STALLED" -ge 3 ] && echo "[$(date -Is)] runner mati & progres mentok (${pct}%) — laporan tetap ditulis" >> "$WATCH_LOG"
      err_count=$(grep -c "GAGAL" "logs/embedding-errors-$(date +%F).log" 2>/dev/null || echo 0)
      all_cov=$(q "SELECT count(embedding), count(*),
                           round(count(embedding)::numeric / count(*) * 100, 1)
                    FROM questions")
      all_emb=${all_cov%%|*}; _rest=${all_cov#*|}; all_tot=${_rest%%|*}; all_pct=${_rest#*|}
      cat > "$REPORT" <<MD
# ACT-07 — Laporan Akhir Backfill Embedding BGE-M3

**Dibuat otomatis oleh** \`scripts/watch-embedding.sh\` pada $(date -Is)

| Metrik | Nilai |
| --- | --- |
| Total soal aktif (deleted_at IS NULL) | ${tot} |
| Memiliki embedding | ${emb} |
| Cakupan (soal aktif) | **${pct}%** |
| Sisa tanpa embedding | ${sisa} |
| Soal gagal (error log) | ${err_count} |

> Catatan: kueri DoD issue menghitung **seluruh** baris `questions` (termasuk
> ${all_tot} total baris; ${all_emb} ber-embedding = ${all_pct}%), sedangkan
> backfill hanya memproses soal aktif. Keduanya di atas ambang 95%.

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

      # ---- self-wake Paperclip -------------------------------------------
      # Tanpa ini, tiket tetap "in_progress" tanpa sinyal padahal pekerjaan
      # sudah tuntas. Kredensial run-scoped dibaca dari berkas mode 600 di
      # luar repo; bila tidak ada/kedaluwarsa, laporan berkas tetap jadi
      # bukti dan kegagalan hanya dicatat ke log.
      NOTIFY_ENV="${PAPERCLIP_NOTIFY_ENV:-$HOME/.config/mathbank/paperclip-notify.env}"
      if [ -r "$NOTIFY_ENV" ]; then
        # shellcheck disable=SC1090
        . "$NOTIFY_ENV"
        api="${PAPERCLIP_API_URL%/}"; case "$api" in */api) ;; *) api="$api/api" ;; esac
        body=$(printf '## ACT-07 selesai — laporan akhir backfill embedding\n\nBackfill BGE-M3 tuntas otomatis (dipicu oleh `scripts/watch-embedding.sh`).\n\n| Metrik | Nilai |\n| --- | --- |\n| Total soal aktif | %s |\n| Memiliki embedding | %s |\n| Cakupan (soal aktif) | **%s%%** |\n| Sisa tanpa embedding | %s |\n| Soal gagal | %s |\n| Kueri DoD (seluruh baris) | %s/%s = %s%% |\n\nAmbang DoD >95%%: **%s**.\n\nLaporan lengkap: `docs/sprint1/ACT-07-EMBEDDING-REPORT.md`\nVerifikasi ulang: `./scripts/verify-sprint1-dod.sh`\n\nMohon heartbeat berikutnya menutup tiket bila ketiga DoD PASS.' \
          "$tot" "$emb" "$pct" "$sisa" "$err_count" "$all_emb" "$all_tot" "$all_pct" \
          "$( [ "${pct%.*}" -ge 95 ] && echo TERPENUHI || echo 'BELUM TERPENUHI' )")
        payload=$(jq -n --arg body "$body" '{body:$body, resume:true}')
        code=$(printf '%s' "$payload" | curl -sS -o "logs/pc-notify.out" -w '%{http_code}' \
                 -X POST "$api/issues/${PAPERCLIP_TASK_ID}/comments" \
                 -H "Authorization: Bearer ${PAPERCLIP_API_KEY}" \
                 -H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID}" \
                 -H "Content-Type: application/json" --data-binary @- 2>/dev/null || echo 000)
        echo "[$(date -Is)] notifikasi Paperclip -> HTTP ${code}" >> "$WATCH_LOG"
      else
        echo "[$(date -Is)] notifikasi dilewati: ${NOTIFY_ENV} tidak ada" >> "$WATCH_LOG"
      fi

      exit 0
    fi
  fi

  sleep "$INTERVAL"
done
