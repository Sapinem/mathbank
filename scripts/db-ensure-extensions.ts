/**
 * Pra-migrasi: pastikan ekstensi PostgreSQL ada SEBELUM `drizzle-kit migrate`.
 *
 * KENAPA perlu: migrasi `0000_*.sql` mendefinisikan kolom `embedding vector(1024)`
 * dan index `gin_trgm_ops`, tetapi **tidak** memuat ekstensi pemiliknya. Di DB
 * bersih, `CREATE TABLE questions` gagal dengan `type "vector" does not exist`
 * → seluruh skema gagal dibangun (temuan review M1, 2026-09-30).
 *
 * Karena `CREATE EXTENSION` harus jalan LEBIH DULU, ia tidak bisa ditaruh di
 * `drizzle/manual/db_safety.sql` (yang dijalankan sesudah migrate). Skrip ini
 * di-chain di depan `pnpm db:migrate`.
 *
 * ── Soal hak (penting) ──────────────────────────────────────────────────────
 * `CREATE EXTENSION vector` **butuh superuser** (pgvector tak dapat dipasang
 * oleh role biasa). Di DB yang sudah disiapkan, ekstensi dibuat SEKALI oleh
 * superuser (lihat `drizzle/manual/00-extensions.sql`). Skrip ini:
 *   - memeriksa ekstensi mana yang sudah ada;
 *   - mencoba membuat yang belum ada (berhasil untuk pgcrypto/pg_trgm);
 *   - bila `vector` belum ada & tak punya hak → **BERHENTI dengan pesan jelas**
 *     berisi perintah superuser yang harus dijalankan. Jangan lanjut migrate
 *     (akan gagal membingungkan di tengah jalan).
 *
 * Idempotent: aman dijalankan berulang.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

/** Ekstensi yang WAJIB ada sebelum migrasi Drizzle berjalan. */
const REQUIRED_EXTENSIONS = ["pgcrypto", "pg_trgm", "vector"] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension
    `;
    const present = new Set(rows.map((r) => r.extname));

    const missing: string[] = [];
    for (const ext of REQUIRED_EXTENSIONS) {
      if (present.has(ext)) {
        console.log(`  ✓ ekstensi ${ext} (sudah ada)`);
        continue;
      }
      try {
        await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
        console.log(`  ✓ ekstensi ${ext} (dibuat)`);
      } catch (err) {
        const e = err as { code?: string };
        if (e.code === "42501") {
          // permission denied — butuh superuser.
          missing.push(ext);
        } else {
          throw err;
        }
      }
    }

    if (missing.length > 0) {
      console.error(
        `\n✗ Ekstensi berikut belum ada & butuh SUPERUSER untuk dibuat: ${missing.join(", ")}`,
      );
      console.error(
        "\n  Jalankan SEKALI sebagai superuser (postgres), lalu ulangi `pnpm db:migrate`:\n",
      );
      console.error(
        `    psql -p 5433 -U postgres -d <db> -f drizzle/manual/00-extensions.sql\n`,
      );
      console.error(
        "  (atau: sudo -u postgres psql -p 5433 -d <db> -c 'CREATE EXTENSION IF NOT EXISTS vector;')\n",
      );
      process.exit(1);
    }

    console.log("✓ Pra-migrasi: semua ekstensi siap.");
  } catch (err) {
    console.error("✗ Gagal menyiapkan ekstensi pra-migrasi:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void main();
