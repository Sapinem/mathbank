#!/usr/bin/env bash
# Deploy MathBank TANPA jendela 500.
#
# MASALAH: `next build` menulis langsung ke `.next`, sementara
# `mathbank.service` menyajikan `.next` itu juga. Selama build berjalan,
# `.next` sedang setengah jadi → SEMUA permintaan balas 500
# (`Cannot find module .next/server/middleware-manifest.json`).
#
# SOLUSI: build ke `.next.new` dulu (situs tetap sehat memakai `.next` lama),
# baru setelah build SUKSES tukar direktori secara atomik. Bila build gagal,
# `.next` lama tidak tersentuh → situs tidak pernah turun.
#
# Pemakaian:  ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
NEW="$APP_DIR/.next.new"
CUR="$APP_DIR/.next"
OLD="$APP_DIR/.next.old"

echo "==> Membersihkan sisa build terdahulu"
rm -rf "$NEW" "$OLD"

echo "==> Build ke .next.new (situs tetap memakai .next lama)"
if ! NEXT_DIST_DIR=.next.new pnpm build; then
  echo "!! BUILD GAGAL — .next lama tidak disentuh, situs tetap sehat." >&2
  rm -rf "$NEW"
  exit 1
fi

if [ ! -f "$NEW/BUILD_ID" ]; then
  echo "!! Build selesai tapi BUILD_ID tidak ada — dibatalkan." >&2
  rm -rf "$NEW"
  exit 1
fi

echo "==> Build sukses (BUILD_ID: $(cat "$NEW/BUILD_ID"))"
echo "==> Menukar direktori secara atomik"
if [ -d "$CUR" ]; then mv "$CUR" "$OLD"; fi
mv "$NEW" "$CUR"

echo "==> Restart layanan"
systemctl --user restart mathbank.service

echo "==> Menunggu layanan siap"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1234/ || echo "000")
  # 307 = redirect ke login → normal. 000/500 = belum siap / rusak.
  if [ "$code" = "307" ] || [ "$code" = "200" ]; then
    echo "==> Layak jalan (HTTP $code) setelah ${i} detik"
    rm -rf "$OLD"
    echo "==> DEPLOY BERHASIL"
    exit 0
  fi
  sleep 1
done

echo "!! Layanan tidak sehat setelah 30 detik (HTTP $code). Mengembalikan build lama…" >&2
systemctl --user stop mathbank.service || true
rm -rf "$CUR"
if [ -d "$OLD" ]; then mv "$OLD" "$CUR"; fi
systemctl --user start mathbank.service
echo "!! Sudah dikembalikan ke build sebelumnya." >&2
exit 1
