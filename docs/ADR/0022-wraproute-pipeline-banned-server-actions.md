# ADR-0022 — Pipa Tunggal API Gateway `wrapRoute()` & Penegakan Larangan Server Actions untuk Mutasi

- **Status:** Diusulkan (Direncanakan untuk MathBank v2.0 Fase 3)
- **Tanggal:** 2026-10-07
- **Pengambil keputusan:** Principal Software Architect & Tim Pengembang
- **Terkait:** `docs/RENCANA-MATHBANK-V2.md` (§3.A & §3.B),
  `docs/ADR/0002-arsitektur-berlapis-l1-l9.md` (L4 API Gateway & L5 Service Layer),
  `docs/ADR/0004-better-auth-multi-role.md` (RBAC),
  `CONSTRAINTS.md` #23 (dev bypass), #34 (anti-bocor kunci), #35 (izin ber-own di service)

## Konteks

Dalam ekosistem Next.js App Router modern, terdapat dua paradigma utama untuk mutasi data: Route Handlers (`app/api/**/route.ts`) dan Server Actions (`"use server"`). 

Evaluasi arsitektur dan pemodelan ancaman (*STRIDE Threat Modeling*) pada MathBank menunjukkan kelemahan fatal jika Server Actions digunakan untuk mutasi data domain inti:
1. **Risiko Otorisasi Bocor / Lupa Dipasang (*Authorization Drift*):** Server Actions diperlakukan sebagai fungsi RPC publik yang dapat dieksekusi langsung lewat POST request acak. Jika pengembang lupa memanggil pengecekan sesi atau izin di awal fungsi Server Action, mutasi sensitif (seperti mengubah kunci jawaban atau menghapus butir soal) dapat dieksekusi tanpa proteksi.
2. **Ketiadaan Pipa Terpadu (*Fragmented Middleware*):** Menegakkan urutan wajib: `Autentikasi -> Otorisasi RBAC -> Rate Limiting -> Validasi Skema Zod -> Eksekusi Service -> Pencatatan Audit Trail` menjadi rapuh jika harus ditulis manual di setiap Server Action secara terpisah.
3. **Risiko Kebocoran Data Sensitif via Server Actions:** Server Actions secara implisit mengembalikan payload komponen React yang berisiko mengekspos kolom tersembunyi (seperti kunci jawaban asli atau bobot rahasia) ke klien.
4. **Audit Trail Inkonsisten:** Mutasi lewat Server Actions kerap lolos dari mekanisme pencatatan riwayat `audit_logs` append-only karena tidak adanya *interceptor* terpusat.

## Keputusan

1. **Larangan Mutlak Penggunaan Server Actions untuk Mutasi Data (*Banned Server Actions*):**
   - Melarang direktif `"use server"` untuk seluruh mutasi entitas domain (soal, opsi, bundel, taksonomi, pengguna).
   - Seluruh mutasi dari antarmuka pengguna (UI) **wajib** menggunakan Route Handlers terstandarisasi (`/api/v1/*`) yang dipanggil via React Query / HTTP Client terpadu.
2. **Standardisasi Pipa Tunggal API Gateway via `wrapRoute()`:**
   - Seluruh endpoint Route Handler mutasi (POST, PATCH, PUT, DELETE) wajib dibungkus oleh fungsi pelindung tingkat tinggi `wrapRoute()`:
   ```
   HTTP Request ──► proxy.ts ──► wrapRoute(spec, handler)
                                   ├─ 1. resolveActor(request)          ──► 401 jika anonim
                                   ├─ 2. assertCan(actor, permission)   ──► 403 jika tak berwenang
                                   ├─ 3. checkRateLimit(actor, ip)      ──► 429 jika meluap
                                   ├─ 4. validatePayload(zodSchema)     ──► 400 jika cacat
                                   ├─ 5. Domain Service Invocation      ──► Logika bisnis L5
                                   ├─ 6. recordAudit(actor, action)     ──► Append-only audit log
                                   └─ 7. JSON Response Envelope         ──► { data } atau { error }
   ```
3. **Strict No-AnswerKey Projection Enforced at Gateway/Service:**
   - Pipa respon secara deterministik menyaring kolom `is_correct`, `solutions`, dan `non_option_answer_key` bila aktor tidak memiliki izin peran guru, penelaah, atau admin.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| **Pakai Server Actions dengan Pembungkus `createSafeAction`** | Tetap rentan terhadap *hidden RPC exposure*, menyulitkan integrasi dengan klien non-web (seperti AI MCP Server, CLI runner, atau ekspor eksternal), dan mempersulit *mocking* serta *black-box HTTP testing*. |
| **Route Handler Bebas / Telanjang Tanpa `wrapRoute()`** | Menghasilkan duplikasi kode boiler-plate berulang di puluhan file route, dan menciptakan risiko fatal jika ada pengembang atau subagent lupa memanggil `recordAudit` atau `assertCan`. |
| **Otorisasi Murni di Layer Middleware Next.js (`proxy.ts`)** | `proxy.ts` / Next.js middleware berjalan pada edge runtime yang tidak memiliki koneksi pool database langsung untuk mengevaluasi izin granular berbasis kepemilikan (`own` permission check, CONSTRAINTS #35). |

## Konsekuensi

**Positif:**
- **Jaminan Keamanan Deterministik:** Tidak ada satu pun mutasi data yang dapat lolos tanpa lolos uji otorisasi, validasi Zod, dan pencatatan audit log resmi.
- **Kepatuhan Audit Trail 100%:** Seluruh aksi manipulasi soal dan bundel tercatat akurat di tabel `audit_logs` dengan `user_id`, `ip_address`, dan `entity_id` yang valid.
- **Interoperabilitas Sempurna:** API yang sama dapat diakses secara mulus oleh antarmuka Web UI, agen AI MCP, skrip otomatisasi CLI, dan integrasi Moodle.

**Negatif / utang:**
- Form di sisi klien harus menggunakan pendekatan mutation hook React Query alih-alih form native Next.js Server Actions bawaan.
- Perlu refactor bertahap pada endpoint-endpoint lama di MathBank v1.0 yang belum menggunakan wrapper `wrapRoute()`.

## Catatan

- Mengkonfirmasi dan membakukan arsitektur L4 API Gateway dari ADR-0002.
- Sesuai dengan prinsip STRIDE Threat Modeling: menutup celah Tampering, Elevation of Privilege, dan Repudiation.
