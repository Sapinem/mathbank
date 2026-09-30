# CATATAN PENYEMPURNAAN ENTERPRISE & BEST PRACTICES MATHBANK

**Tanggal Penyusunan:** 30 September 2026  
**Status:** 💡 Rekomendasi Arsitektural Enterprise (Lanjutan M1–M7)  
**Tujuan:** Panduan best practices rekayasa perangkat lunak modern untuk meningkatkan keandalan, performa, dan keamanan MathBank.

---

## 🚀 Status Implementasi Best Practices Enterprise

| No | Rekomendasi Best Practice | Status Implementasi | Catatan Technical & Decision |
| :-: | :--- | :---: | :--- |
| 1 | **Batasan Panjang Slug (`slugify`)** | ✅ **Selesai (`ed4ac21`)** | Ditambahkan batas pemotongan per-kolom (`100` char untuk `tags`, `255` char untuk `topics/sources/bundles`) guna mencegah error `500` saat string nama terlalu panjang. |
| 2 | **Header Traceability (`X-Request-ID`)** | ✅ **Selesai (`ed4ac21`)** | Header `X-Request-ID` disertakan pada seluruh respons API & dicatat pada log server. |
| 3 | **Header Idempotensi (`Idempotency-Key`)** | ✅ **Selesai (`ed4ac21`)** | Dikembangkan pada `wrapRoute`: Request POST/PUT ganda dengan Key yang sama dibalas instan via `Idempotent-Replay`. |
| 4 | **Server-Side `"use cache"` Next.js 16** | ⛔ **Dibatalkan (Desain Sadar)** | **Reverted:** Menyebabkan efek *Stale-While-Revalidate* (lag 2-5 detik saat mutasi data) dan mengganggu *guard auth* pada `<Suspense>`. Caching UI sudah optimal di-handle oleh React Query di sisi Klien. |
| 5 | **Transaksi Atomik (`db.transaction`)** | 🟠 **Disarankan untuk M8+** | Mutasi multi-tabel pada pembuatan soal & paket disarankan dibungkus transaksi Drizzle. |
| 6 | **Sanitasi SVG TikZ & Strict CSP** | 🟠 **Disarankan untuk M8+** | Sanitasi DOMPurify pada luaran TikZ SVG untuk mencegah potensi XSS. |
