import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Koneksi database MathBank (PostgreSQL 18, :5433).
 * Driver: postgres.js — pool tunggal, dipakai seluruh service (L5).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL belum diatur (lihat .env.example)");
}

/**
 * Batas koneksi eksplisit: bawaan postgres.js 30 dtk untuk `connect_timeout`
 * membuat probe kesehatan menggantung saat DB drop paket. `statement_timeout`
 * sengaja TIDAK disetel global — handler ingest menunggu embedding hingga
 * 120 dtk, jadi batas per-statement harus dipasang di jalur yang butuh cepat
 * (mis. probe), bukan di seluruh pool.
 */
const queryClient = postgres(connectionString, {
  max: 10,
  connect_timeout: 5,
  idle_timeout: 30,
});

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

export type Database = typeof db;
