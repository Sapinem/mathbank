# PERFORMA.md — Anggaran & Panduan Performa MathBank

> **Status:** 🟡 anggaran ditetapkan; pengukuran terukur belum lengkap.
> **Sifat:** dokumen hidup — perbarui saat ada metrik nyata (Lighthouse, RUM).
> **Prinsip:** jaga aplikasi **padat & cepat** (arah Linear/Vercel) — bukan "optimasi nanti".

---

## 1. Kondisi Saat Ini (nyata, 2026-09-29)

| Aspek | Keadaan |
|-------|---------|
| Build | ✓ Compiled **~0,8–1,8 detik** (Turbopack) |
| Halaman statis | `/`, `/bank-soal`, `/paket`, `/referensi/*`, `/studio/*`, `/sistem/*`, `/telaah` → **○ Static** |
| API | 12 route → **ƒ Dynamic** (server-rendered, benar untuk data) |
| Index DB | **50 index** (+ trigram GIN + HNSW vektor) |
| Font | Roboto Flex + Roboto Mono (self-hosted) |

> Catatan: hampir semua **halaman sudah static** → First Load ringan. Dynamic hanya di API.

---

## 2. Anggaran Performa (target)

| Metrik | Target | Kenapa |
|--------|--------|--------|
| **LCP** (Largest Contentful Paint) | ≤ 2,5 s | persepsi cepat |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | UI responsif |
| **CLS** (Cumulative Layout Shift) | ≤ 0,1 | tak "melompat" |
| **TTFB** | ≤ 500 ms | server cepat |
| **JS bundle** halaman | ≤ 200 kB gzip | hindari bloat |
| Query DB umum | ≤ 50 ms | index benar |
| API p95 | ≤ 300 ms | pengalaman agen/UI |

*(Angka menunggu validasi dengan Lighthouse/RUM nyata.)*

---

## 3. Prinsip

1. **Server Components lebih dulu** — kirim lebih sedikit JS ke klien.
2. **Static bila mungkin** — halaman referensi/telaah sudah ○ Static.
3. **React Compiler** — **jangan** pakai `useMemo`/`useCallback` manual (CONSTRAINTS #6); compiler menangani.
4. **Index DB** — setiap filter/pencarian punya index (50 index; trigram untuk teks, HNSW untuk vektor).
5. **Paginasi wajib** — daftar soal terbatas (`limit` ≤ 100, default 20).
6. **Gambar/media** — pakai `next/image`; ukuran tepat.

---

## 4. Titik Rawan (pantau)

| Area | Risiko | Mitigasi |
|------|--------|----------|
| Bank Soal (banyak kartu + KaTeX) | render berat | virtualisasi bila >100 kartu; paginasi sudah ada |
| Pencarian vektor | query lambat | index HNSW sudah dibuat |
| Ingest (M9) | proses panjang | antrean `ingest_queue` (async), bukan request sinkron |
| Embedding (M10) | latensi AI | cache + batch |

---

## 5. Cara Mengukur (rencana)

- **Lighthouse** / PageSpeed untuk Core Web Vitals.
- **`next build`** output ukuran bundle per route.
- **`EXPLAIN ANALYZE`** untuk query lambat.
- RUM (Real User Monitoring) saat produksi (lihat `OBSERVABILITAS.md`).

---

## 6. Yang Belum Ada (utang)

- [ ] Pengukuran Lighthouse terekam
- [ ] Analisis ukuran bundle per route
- [ ] Budget CI (gagal bila bundle > anggaran)
- [ ] Uji beban API
- [ ] `next.config.ts` masih kosong (belum ada optimasi khusus)

---

## 7. Rujukan

- Skema & index: `SKEMA-DB-DETAIL.md`
- Arsitektur: `DESAIN-PER-LAPISAN-MATHBANK.md`
- Observabilitas: `OBSERVABILITAS.md`
