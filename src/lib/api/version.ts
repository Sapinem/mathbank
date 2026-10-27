/**
 * Konkurensi optimistik (ADR-0030) — ETag, `If-Match`, dan galat prakondisi.
 *
 * KENAPA modul terpisah: `wrapRoute` (L4) butuh parsing header & galat 412/428,
 * sementara service (L3) butuh pembanding versi. Keduanya logika murni tanpa DB,
 * jadi tinggal di satu tempat yang bisa diuji tanpa koneksi.
 *
 * Alur yang ditegakkan:
 *   GET    → respons memuat `ETag: "<version>"` (dan `version` di body)
 *   PATCH  → klien WAJIB kirim `If-Match: "<version>"`
 *   absen  → 428 PRECONDITION_REQUIRED (bukan diam-diam last-write-wins)
 *   basi   → 412 PRECONDITION_FAILED + `details.currentVersion`
 */

/** Error 428 — operasi mutasi baris tanpa `If-Match`. */
export class PreconditionRequiredError extends Error {
  readonly code = "PRECONDITION_REQUIRED";
  constructor(
    message = "Header If-Match wajib diisi. Ambil ETag dari GET sumber daya ini lebih dulu.",
  ) {
    super(message);
    this.name = "PreconditionRequiredError";
  }
}

/** Error 412 — `If-Match` tidak cocok dengan versi baris saat ini. */
export class PreconditionFailedError extends Error {
  readonly code = "PRECONDITION_FAILED";
  /** Versi terkini bila diketahui — memungkinkan klien memutuskan, bukan menebak. */
  readonly currentVersion?: number;
  constructor(
    message = "Sumber daya sudah berubah sejak Anda membacanya. Muat ulang, gabungkan perubahan, lalu ulangi.",
    currentVersion?: number,
  ) {
    super(message);
    this.name = "PreconditionFailedError";
    this.currentVersion = currentVersion;
  }
}

/** Nilai header `ETag` untuk sebuah versi baris. */
export function etagOf(version: number): string {
  return '"' + version + '"';
}

/**
 * Urai `If-Match` menjadi versi yang diharapkan.
 *
 * Diterima: `"3"` (bentuk ETag), `3` (klien malas mengutip), dan `*`.
 * DITOLAK: `W/"3"` — `If-Match` memakai perbandingan KUAT (RFC 9110 §13.1.1);
 * menerima weak validator akan memberi rasa aman yang palsu. Juga ditolak:
 * daftar (`"1", "2"`) — sumber daya di API ini satu baris, satu versi.
 *
 * @throws PreconditionRequiredError bila header absen (428).
 * @throws InvalidIfMatchError bila bentuknya tak dikenali (400).
 */
export function parseIfMatch(header: string | null): number | "*" {
  if (header === null) throw new PreconditionRequiredError();
  const raw = header.trim();
  if (raw === "*") return "*";
  const match = /^(?:"(\d+)"|(\d+))$/.exec(raw);
  if (!match) {
    throw new InvalidIfMatchError(
      raw.startsWith("W/")
        ? "If-Match memakai perbandingan kuat: kirim ETag tanpa awalan W/."
        : 'Header If-Match tidak valid. Gunakan ETag dari GET sebelumnya, mis. If-Match: "3".',
    );
  }
  const version = Number(match[1] ?? match[2]);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new InvalidIfMatchError("Header If-Match harus versi >= 1.");
  }
  return version;
}

/** Error 400 khusus bentuk `If-Match` — dipisah agar pesannya spesifik. */
export class InvalidIfMatchError extends Error {
  readonly code = "INVALID_IF_MATCH";
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "InvalidIfMatchError";
  }
}

/**
 * Bandingkan versi yang diharapkan dengan versi baris.
 *
 * Ini pemeriksaan AWAL untuk pesan galat yang ramah; otoritas tetap pada
 * `UPDATE … WHERE version = ?` di transaksi (lihat `src/lib/db/optimistic.ts`),
 * karena baris bisa berubah di antara baca dan tulis.
 */
export function assertVersionMatches(actual: number, expected: number | "*"): void {
  if (expected === "*") return;
  if (actual !== expected) throw new PreconditionFailedError(undefined, actual);
}
