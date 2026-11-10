# ADR-0032 — Semantik `own` pada Kapabilitas MCP `taxonomy.manage`

- **Status:** Diterima
- **Tanggal:** 2026-11-10
- **Pengambil keputusan:** pemilik produk
- **Terkait:** ADR-0022 (`wrapRoute`), ADR-0026 (deklarasi otorisasi eksplisit), CONSTRAINT #35, `src/lib/mcp/policy.ts`, `src/lib/auth/permissions.ts`

## Konteks

Permukaan MCP punya lapisan kapabilitas sendiri (`MCP_CAPABILITIES`) yang memetakan nama ramah ke izin L1. `canMcp()` tidak menyimpan matriks terpisah: ia mendelegasikan ke `effectiveAccess()`/`can()` sehingga hasilnya selalu mengikuti `PERMISSIONS` di `src/lib/auth/permissions.ts`.

Sebelum ADR ini, `taxonomy:manage` masih bernilai `own`. Nilai itu mematikan fitur taksonomi untuk semua peran non-admin: `assertCan(actor, perm)` di gerbang route dipanggil tanpa `ownerId`, dan `own` tanpa `ownerId` **selalu ditolak** (CONSTRAINT #35). Tabel `topics`, `tags`, `sources`, dan `events` juga tidak punya kolom pemilik, sehingga `own` tak mungkin dipenuhi dari mana pun. ADR-0026 menutup cacat tersebut dengan mengubah `taxonomy:manage` dan `reference:manage` menjadi `"yes"` untuk teacher/reviewer/agent.

Yang tersisa saat itu adalah **divergensi di lapisan MCP**: komentar `src/lib/mcp/policy.ts` masih menyatakan `taxonomy:manage = own` untuk agent, dan `src/lib/mcp/policy.test.ts` menuntut `canMcp(agent, "taxonomy.manage", { ownerId: "orang-lain" }) === false`. Kode mengembalikan `true` karena matriks L1 sudah `yes`, sehingga suite tes merah permanen — bukan karena regresi, tetapi karena tes dan komentar mewakili kebijakan yang sudah dibatalkan ADR-0026.

Pertanyaan yang harus dijawab saat itu: apakah MCP **menambah** lapisan `own` di atas matriks L1, atau **mewarisi** matriks itu apa adanya. Divergensi tersebut ditutup oleh keputusan di bawah dan oleh commit penyelarasan tes.

## Keputusan

**Kapabilitas MCP mewarisi matriks L1 tanpa override. `taxonomy.manage` bernilai `yes` untuk agent, sama seperti teacher dan reviewer.**

1. `canMcp()` tetap mendelegasikan ke `can()`/`effectiveAccess()`; tidak ada cabang khusus per kapabilitas.
2. `own` hanya dipakai untuk izin yang objeknya benar-benar punya pemilik — `question:edit` dan `question:flag`. Untuk izin itu `ownerId` wajib, dan MCP menegakkannya lewat `canMcp(actor, cap, { ownerId })` serta `assertMcpForQuestion` di `tools.ts`.
3. Izin yang tabelnya tidak punya kolom pemilik (`taxonomy:manage`, `reference:manage`) tidak boleh diberi semantik `own` di lapisan mana pun — route, service, maupun MCP.
4. Tes `policy.test.ts` dan komentar `policy.ts` diselaraskan dengan matriks; keduanya artefak basi, bukan spesifikasi.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| MCP memaksa `own` untuk `taxonomy.manage` | `own` mustahil dipenuhi: tabel taksonomi tidak punya kolom pemilik. Hasilnya seluruh operasi taksonomi via MCP ditolak 403 — persis cacat yang diperbaiki ADR-0026, hanya dipindahkan ke lapisan lain. Menjadikannya mungkin butuh kolom `created_by` + migrasi + backfill + aturan kepemilikan baru. |
| MCP menutup `taxonomy.manage` untuk agent sepenuhnya | Menghapus kapabilitas yang sudah dipakai alur dedup/agen tanpa bukti kebutuhan; agent tetap butuh menandai topik agar hasil enrichment bisa dipakai. |
| `own` khusus operasi destruktif (hapus, merge, `clean-unused`) | Butuh izin baru (mis. `taxonomy:delete`) dan keputusan produk tersendiri. Tidak ada permintaan nyata; bila nanti dibutuhkan, jalurnya ADR baru, bukan penafsiran ulang `own`. |

## Konsekuensi

**Positif:**
- Satu sumber kebenaran: matriks L1. Tidak ada lagi kemungkinan MCP dan route berbeda pendapat tentang izin yang sama.
- Suite tes kembali hijau tanpa melonggarkan otorisasi: yang berubah adalah ekspektasi yang salah, bukan gerbang.
- Aturan menjadi eksplisit: `own` menuntut kolom pemilik, dan itu bisa diperiksa saat menambah izin baru.

**Negatif / utang:**
- MCP tidak bisa lebih ketat daripada L1 tanpa ADR baru. Kalau kelak MCP perlu pembatasan khusus, ia harus dinyatakan sebagai keputusan, bukan diselipkan lewat `ownerId`.
- `machine` juga bernilai `yes` untuk `taxonomy:manage` (ADR-0026). Risikonya diterima karena permukaan MCP untuk `machine` dibatasi registrasi tool dan `apiKeyAllows`, tetapi ini titik yang perlu dijaga bila tool taksonomi baru ditambahkan.
- Bila kelak taksonomi butuh kepemilikan, kolom `created_by` + migrasi + backfill harus dibuat lebih dulu; sampai itu ada, `own` tidak boleh dipakai untuk tabel tersebut.

## Catatan

- Kode: `src/lib/mcp/policy.ts` (`MCP_CAPABILITIES`, `canMcp`), `src/lib/mcp/policy.test.ts`, `src/lib/auth/permissions.ts` (`taxonomy:manage`).
- ADR-0026 §"Koreksi matriks" adalah asal keputusan `yes`; ADR ini hanya menegaskan bahwa lapisan MCP tidak menyimpang darinya.
- Penyelarasan tes dan komentar: commit `4717290` (`test(mcp): selaraskan taxonomy.manage dengan ADR-0026`) di branch `chore/deps-upgrade-only` (PR #15).
- Penomoran: ADR 0028–0031 berada di branch `chore/deps-upgrade-2026-11` (PR #14); branch `chore/deps-upgrade-only` (PR #15) hanya memuat 0001–0027 + 0032. Nomor 0032 dipakai agar tidak bertabrakan saat kedua branch bergabung. Berkas ini ada di kedua branch dengan isi identik, sehingga penggabungan tidak menimbulkan konflik.
- Verifikasi: `pnpm check` hijau di kedua branch — job CI "Mutu (check + DB)" lulus di PR #14 dan PR #15, termasuk `db:verify` di dua DB dan `test:db`.
