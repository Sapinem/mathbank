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

const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

export type Database = typeof db;
