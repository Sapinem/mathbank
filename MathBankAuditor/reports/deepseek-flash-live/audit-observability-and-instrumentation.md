Audit selesai. Laporan: **`docs/audit/2026-10-18-audit-observability-instrumentation.md`** (+ registrasi di `docs/PETA-DOKUMEN.md` sesuai CONSTRAINTS #31).

## Satu koreksi penting di awal

**Skill `observability-and-instrumentation` tidak ada** di lingkungan ini (`Unknown skill`). Saya tidak mengarang rubriknya. Sebagai gantinya, baseline kepatuhan memakai kontrak proyek sendiri: `docs/OBSERVABILITAS.md`, `SLA-SLO.md`, `KONTRAK-API.md`, `KEAMANAN.md`, `CONSTRAINTS.md`. Ini dicatat di kepala laporan agar tidak terbaca sebagai audit "skill resmi".

## Hasil: 5 HIGH, 7 MEDIUM, 6 LOW, 2 kontrol ✅

| Sev | Temuan |
|---|---|
| 🔴 **O-01** | `redact()` hanya menyaring **nama kunci**. Rahasia di dalam `Error.message` dan stack (non-produksi) **lolos** — dibuktikan dengan probe: `postgres://u:REDACTED@host/db?apikey=REDACTED` keluar utuh |
| 🔴 **O-06** | Label metrik = path mentah. 100 request ke `/api/questions/<uuid>` → **101 label**. `Map` tak berbatas → potensi memory growth + ID entitas bocor lewat `/api/metrics` |
| 🔴 **O-07** | `percentile()` memakai `slice(0, filled)`; saat buffer penuh ia membaca seluruh array termasuk slot `0` yang belum ditimpa → **p95 turun palsu** justru pada beban tinggi |
| 🔴 **O-10** | `/api/health` & `/api/ready` **publik tanpa rate-limit** dan mengembalikan `err.message` Postgres mentah (`connect ECONNREFUSED 127.0.0.1:1`, `password authentication failed for user "mathbank"`) |
| 🔴 **O-19** | Alerting belum ada (diakui di dokumen) — sehingga semua sinyal di atas tak pernah memicu siapa pun |
| 🟠 | Tidak ada access log sukses & `durationMs` tak pernah di-log (meski didokumentasikan); `requestId` tak ada di body 500; `prune()` di rate-limit & idempotensi **tak pernah dipanggil**; SLO tak terpetakan ke metrik; `X-Request-ID` klien dibuang Caddy; XFF spoofable; rate-limit opt-in |

## Yang perlu Anda ketahui tentang prosesnya

- **Dua kesalahan saya sendiri yang saya benar sebelum finalisasi:** hitungan cakupan `wrapRoute` pertama (loop shell) salah — saya klaim 40 route tanpa wrapper, faktanya **40 via wrapper / 11 tanpa**, dan 5 dari 11 itu stub 410 + endpoint health sendiri. Temuan O-03 pun awalnya saya overstate ("galat tak ter-log sama sekali") padahal semua error **memang** tercatat; yang hilang hanya access log sukses. Keduanya sudah dikoreksi, dan koreksinya dicatat di §7.
- **SEC-02 dilaporkan sebagai temuan lama**, bukan baru — sudah terbuka di `KEAMANAN.md` sejak audit 2026-10-17.
- **O-07 bersifat analitis**, bukan probe runtime (probe saya hanya sampai 100 sampel). Saya tandai eksplisit; tes regresi >512 sampel disarankan saat remediasi.
- **Repo tidak hijau saat audit:** `check-names.test.ts` gagal karena berkas `scripts/dev/*` berbahasa Indonesia. Tidak saya perbaiki (read-only), tapi juga tidak saya diamkan.

## Yang belum selesai
Tidak ada kode aplikasi yang diubah. Belum ada remediasi — 12 rekomendasi di §5 diurutkan berdasarkan nilai/risiko, dimulai dari O-01 dan O-10 (perubahan kecil, dampak tinggi). Kalau mau, saya bisa mulai dari REKOM-03 + REKOM-04.
