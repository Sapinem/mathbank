# RISET-BETTER-AUTH.md — Evaluasi Better Auth Penuh vs Otorisasi Sendiri

> **Status:** ✅ riset selesai 2026-09-29 · **Rekomendasi: tetap otorisasi sendiri** (lihat §6).
> **Pemicu:** pertanyaan "kalau pakai Better Auth sudah gampang kan RBAC-nya?"
> **Kesimpulan:** Better Auth punya RBAC bawaan, tapi **tak menjawab** kebutuhan inti MathBank (multi-role + `own`).

---

## 1. Versi & Fakta Dasar

| Item | Nilai |
|------|-------|
| better-auth terpasang | **1.7.6** (dikonfirmasi `node_modules`) |
| Rilis 1.7 | salah satu rilis terbesar; fokus OAuth/OIDC, enterprise identity, MCP auth |
| Lisensi | MIT, self-hosted |
| Adapter | `@better-auth/drizzle-adapter` (dipakai) |
| Plugin API key | `@better-auth/api-key` (dipakai) |

> ⚠️ Sebagian tanggal rilis dari sumber sekunder — verifikasi via `npm view better-auth version` sebelum rilis produksi.

---

## 2. RBAC Bawaan Better Auth — Apa yang Ditawarkan

Better Auth punya **dua plugin** untuk otorisasi:

### a. Plugin `admin`
- Mengelola pengguna (buat, ban, impersonate, revoke session).
- Punya **`role`** dengan kustomisasi via `createAccessControl`.
- Contoh role: `admin`, `user` + role kustom.
- **Multi-role** disimpan sebagai **string dipisah koma** (`"admin,user"`) → **harus split manual** saat membaca.

### b. Plugin `organization`
- Multi-tenancy: organisasi, anggota, tim.
- RBAC penuh via `createAccessControl({...})`:
  ```ts
  const ac = createAccessControl({ question: ["create","read","update"] });
  const teacherRole = ac.newRole({ question: ["create","read"] });
  // server: auth.api.hasPermission({ body: { permissions: { question: ["update"] } } })
  ```
- Role bawaan: `owner`, `admin`, `member`.

**Inti modelnya:** resource → statements (CRUD) → role → user. **Biner:** punya izin atau tidak.

---

## 3. Kebutuhan MathBank vs Kemampuan Plugin

| Kebutuhan MathBank | Plugin Better Auth | Keterangan |
|---|---|---|
| **Multi-role per user** (guru + reviewer) | ⚠️ | admin: string koma (split manual); organization: per-organisasi, bukan per-domain |
| **Izin `own`** (edit soal miliknya sendiri) | ❌ | model biner "punya izin / tidak"; **tak ada konsep kepemilikan resource** |
| **Peran domain** (agent, machine) | ⚠️ | perlu dipaksa ke model organisasi yang tak pas |
| **Guard pure, unit-testable** | ⚠️ | terikat `auth.api.hasPermission` (butuh request/DB) |
| **180+ kombinasi** (16 aksi × 5 peran) | — | kita uji exhaustive; plugin tak dirancang untuk itu |

**Titik kritis:** **izin `own`** adalah kebutuhan **inti** MathBank (guru boleh hapus *soal miliknya sendiri*, tidak milik orang lain). Better Auth **tak punya** konsep ini — harus ditulis sendiri. Jadi **sekalipun** pakai plugin, otorisasi `own` tetap kode kita.

---

## 4. Kalau Memaksa Pakai Better Auth Penuh

Tiga opsi:

| Opsi | Cara | Biaya |
|------|------|-------|
| **A. Plugin organization** | Paksa "organisasi" = sekolah; role = peran domain | Model dipaksa; `own` tetap manual; migrasi besar |
| **B. Plugin admin** | Pakai `role` string koma | Split manual; `own` tetap manual; lebih sedikit fitur |
| **C. Pertahankan sendiri** | Matriks + guards (kondisi kini) | Sudah jalan, teruji, nol migrasi |

**Semua opsi A/B tetap butuh kode `own` sendiri** → keuntungan plugin menyusut tinggal ~"manajemen user".

---

## 5. Tradeoff Lengkap

### Pakai Better Auth penuh (plugin admin/organization)

**Kelebihan**
- Manajemen user bawaan (ban, impersonate, create).
- API `hasPermission` siap pakai.
- Tak perlu tulis mesin izin dari nol.

**Kekurangan**
- **`own` tetap harus manual** → duplikasi konsep.
- **Multi-role awkward** (string koma / model organisasi).
- **Lock-in** ke API & model plugin (upgrade bisa memecah).
- **Model tak cocok** (agent/machine bukan "anggota organisasi").
- Migrasi: tabel `user_roles` → skema plugin; tes izin ditulis ulang.
- Bundle lebih besar (~16 kB+ untuk plugin).

### Otorisasi sendiri (kondisi kini)

**Kelebihan**
- **Tepat** untuk multi-role + `own` + peran domain.
- **Pure functions** → cepat, unit-testable (kini **43 tes** modul auth).
- **Nol lock-in** pada otorisasi; Better Auth hanya untuk auth.
- Matriks = **satu tempat** ("siapa boleh apa"), mudah diaudit.

**Kekurangan**
- Harus tulis & pelihara sendiri (kini ~250 baris + 43 tes).
- Manajemen user UI belum ada (perlu dibangun saat M-nya).

---

## 6. Rekomendasi (tegas)

**Pertahankan otorisasi sendiri; pakai Better Auth HANYA untuk autentikasi** (kondisi kini).

**Alasan:**
1. **Kebutuhan `own` + multi-role tidak dijawab plugin** → keuntungan plugin menyusut.
2. **Model plugin tak cocok** dengan peran `agent`/`machine`.
3. **Kita sudah punya** matriks teruji (43 tes) + guard pure.
4. **Nol migrasi, nol lock-in** pada lapisan otorisasi.
5. **ADR-0004 sudah memutuskan** hal ini — riset ini **mengukuhkannya**.

**Yang tetap berguna dari Better Auth (sudah dipakai):**
- Session + API key (`@better-auth/api-key`) untuk autentikasi.
- Boleh **nanti** pertimbangkan plugin admin **hanya** untuk *manajemen user* (bukan otorisasi).

---

## 7. Temuan Lain (relevan)

- **Next.js 16 mengganti `middleware.ts` → `proxy.ts`** (Node.js runtime default). Kita **tak memakai** middleware/proxy (auth di `wrapRoute`) — tak terpengaruh, tapi catat untuk masa depan.
- **Riwayat keamanan Better Auth (2025–2026):** ada beberapa advisory (OAuth/OIDC, rate-limit IPv6, session). **Aksi:** jaga versi terbaru + pantau advisory; ini memperkuat keputusan **meminimalkan** permukaan (pakai sedikit plugin).
- **Rate limit API key** bersifat **per-key**, bukan per-IP → tetap butuh rate-limit per-IP di reverse proxy (utang **S1**, `KEAMANAN.md`).

---

## 8. Rujukan

- `ADR-0004` (Better Auth multi-role) — keputusan yang dikukuhkan riset ini
- `KEAMANAN.md` §RBAC
- `src/lib/auth/` — implementasi (roles, permissions, guards, resolve)
- Sumber: docs resmi Better Auth (`/docs/plugins/admin`, `/docs/plugins/organization`), blog rilis 1.7, advisory keamanan komunitas 2026
