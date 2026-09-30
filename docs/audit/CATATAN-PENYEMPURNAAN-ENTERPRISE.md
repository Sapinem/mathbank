# CATATAN PENYEMPURNAAN ENTERPRISE & BEST PRACTICES MATHBANK

**Tanggal Penyusunan:** 30 September 2026  
**Status:** 💡 Rekomendasi Arsitektural Enterprise (Lanjutan M1–M7)  
**Tujuan:** Panduan best practices rekayasa perangkat lunak modern untuk meningkatkan keandalan, performa, dan keamanan MathBank.

---

## 🚀 5 Best Practices Enterprise untuk Diadopsi

### 1. Transaksi Basis Data Atomik (`db.transaction`) pada Mutasi Multi-Tabel
- **Konteks:** Pada operasi mutasi yang menyentuh beberapa tabel berurutan (seperti `createQuestion` yang menulis ke `questions`, `question_options`, `question_topics`, dan `question_tags`).
- **Rekomendasi:** Bungkus seluruh mutasi dalam satu transaksi atomik Drizzle:
  ```ts
  await db.transaction(async (tx) => {
    const [q] = await tx.insert(questions).values(...).returning();
    await tx.insert(questionOptions).values(...);
    await tx.insert(questionTopics).values(...);
  });
  ```
- **Manfaat:** Mencegah *partial write* atau data yatim (*orphan data*) jika koneksi basis data atau server terputus di tengah eksekusi.

---

### 2. Strategi Caching Referensi Taksonomi dengan `"use cache"` Next.js 16
- **Konteks:** Data referensi statis (Pohon Topik, Sumber, Event, Grade, Kesulitan) diakses pada hampir seluruh halaman UI tetapi sangat jarang berubah.
- **Rekomendasi:** Manfaatkan direktif `"use cache"` dan `cacheTag` Next.js 16 pada `taxonomy-service.ts`:
  ```ts
  export async function getCachedTopics() {
    "use cache";
    cacheTag("taxonomy-topics");
    return listTopics();
  }
  ```
  Panggil `revalidateTag("taxonomy-topics")` hanya saat terjadi aksi mutasi `CREATE`, `UPDATE`, atau `DELETE` pada referensi.
- **Manfaat:** Mengurangi beban kueri PostgreSQL hingga **80–90%** untuk data referensi statis dan mempercepat navigasi UI.

---

### 3. Proteksi Idempotensi Request (`Idempotency-Key` Header)
- **Konteks:** Penulis atau penguji yang menyimpan soal/paket dalam kondisi jaringan lambat berisiko menekan tombol *Simpan* berkali-kali (*double-submit*).
- **Rekomendasi:** Tambahkan opsi penanganan header `Idempotency-Key` (UUID) pada `wrapRoute` untuk endpoint mutasi `POST` / `PUT`:
  * Simpan status request yang sedang diproses dalam Memory Cache / Redis selama 60 detik.
  * Jika request dengan `Idempotency-Key` yang sama masuk kembali, kirimkan ulang respons sebelumnya tanpa memicu kueri DB baru.
- **Manfaat:** Menjamin idempotensi penuh dan mencegah terciptanya data duplikat.

---

### 4. Sanitasi SVG TikZ & Strict Content Security Policy (CSP)
- **Konteks:** MathBank mendukung rendering KaTeX dan diagram geometri TikZ (SVG).
- **Rekomendasi:**
  * Sanitasi seluruh luaran SVG TikZ menggunakan pustaka seperti `DOMPurify` / `sanitize-svg` untuk membuang tag berbahaya (`<script>` atau atribut `onload=...`).
  * Konfigurasikan header `Content-Security-Policy` di Next.js `middleware.ts` / `next.config.ts` untuk melarang eksekusi inline script yang tak terverifikasi.
- **Manfaat:** Memproteksi aplikasi dari potensi ancaman *Cross-Site Scripting (XSS)*.

---

### 5. Structured Logging & Trace ID Tracking (`requestId`)
- **Konteks:** Penanganan error saat ini ditangani oleh `wrapRoute` dan dicatat ke `console.error` atau `audit_logs`.
- **Rekomendasi:** Bangun `requestId` unik (UUIDv7 / shortid) di awal setiap request API pada `wrapRoute`:
  * Sertakan `requestId` pada header respons HTTP (`X-Request-ID`).
  * Masukkan `requestId` ke dalam entri log server dan `audit_logs`.
- **Manfaat:** Memudahkan tim pengembang/DevOps melakukan penelusuran balik (*traceability*) seluruh urutan log hanya dari satu ID insiden.
