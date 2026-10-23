import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const t = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
t.forEach((r) => console.log(r.tablename));
await sql.end();
