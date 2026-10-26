import type { Actor } from "@/lib/auth/actor";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Deklarasi otorisasi per method route (CONSTRAINT #35).
 *
 * KENAPA: `permission` opsional membuat tiga keadaan bercampur dan tak bisa
 * dibedakan dari "lupa": (a) gerbang di route, (b) otoritas di service karena
 * izinnya ber-`own`, (c) sengaja publik. Akibatnya peninjau harus membaca
 * komentar, dan komentar bisa basi (pernah terjadi: `bundles/route.ts`).
 *
 * `authz` WAJIB di setiap `wrapRoute`, sehingga route baru tanpa deklarasi
 * gagal di `typecheck` — bukan sekadar konvensi. Diperiksa juga oleh
 * `scripts/check-authz.ts` (verifikasi silang ke matriks & berkas service).
 */

/**
 * Izin yang **tidak boleh** dipasang sebagai gerbang route.
 *
 * Semuanya punya `own` di matriks: `assertCan` di route dipanggil tanpa
 * `ownerId`, jadi gerbangnya SELALU menolak peran ber-`own` (kambuh T-M4-3).
 * `taxonomy:manage`/`reference:manage` tidak lagi di sini karena matriksnya
 * sudah `yes` (tabelnya tak punya pemilik) — lihat `permissions.ts`.
 */
export type NonOwnPermission = Exclude<
  Permission,
  | "question:edit"
  | "question:delete"
  | "question:hardDelete"
  | "question:flag"
  | "bundle:manage"
>;

/** Deklarasi otorisasi satu method route. */
export type Authz =
  /** Tanpa login. Wajib beralasan; juga wajib terdaftar di allowlist pemeriksa. */
  | { kind: "public"; reason: string }
  /** Login wajib, tanpa izin khusus (mis. membaca identitas sendiri). */
  | { kind: "authenticated" }
  /** Gerbang izin di `wrapRoute`. Izin ber-`own` ditolak oleh tipe. */
  | { kind: "route"; permission: NonOwnPermission }
  /**
   * Otoritas ditegakkan di service yang punya objeknya (`ownerId`).
   * `enforcedIn` = `path.ts:namaFungsi` — nama fungsi, bukan nomor baris.
   * `routeGate` = gerbang kasar yang DIPERTAHANKAN (mis. `question:view`
   * pada route bundle) agar perilaku tidak berubah.
   */
  | { kind: "service"; enforcedIn: string; routeGate?: NonOwnPermission };

/**
 * Tipe `actor` yang diterima handler: `null` hanya untuk route publik.
 * Menjaga 64 handler tetap bertipe `Actor` tanpa cast.
 */
export type ActorFor<T extends Authz> = T["kind"] extends "public" ? Actor | null : Actor;
