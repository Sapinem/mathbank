/**
 * Seed akun DEMO (dev saja) — Admin / Guru / Penelaah.
 *
 * Tujuan: memungkinkan **login demo** nyata lewat better-auth (session cookie),
 * sehingga peran diambil dari `user_roles` persis seperti produksi.
 *
 * ⚠️ Jalankan HANYA di dev. Menolak jalan bila NODE_ENV=production.
 *
 * Pemakaian: `pnpm seed:users`
 */
import { config } from "dotenv";

config({ path: ".env" }); // WAJIB sebelum impor apa pun yang membaca DATABASE_URL

if (process.env.NODE_ENV === "production") {
  throw new Error("seed-users DILARANG di produksi.");
}

async function main() {
  const { eq, and } = await import("drizzle-orm");
  const { auth } = await import("@/lib/auth/server");
  const { db } = await import("@/lib/db");
  const { authUser, userRoles } = await import("@/lib/db/schema/auth");
  const { DEMO_USERS, DEMO_PASSWORD } = await import("@/lib/auth/demo-users");

  console.log("Seed akun demo (dev)…");
  for (const u of DEMO_USERS) {
    const existing = await db
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, u.email));
    let id = existing[0]?.id;

    if (!id) {
      const res = (await auth.api.signUpEmail({
        body: { email: u.email, password: DEMO_PASSWORD, name: u.name },
      })) as { user: { id: string } };
      id = res.user.id;
      console.log(`  + akun ${u.email}`);
    } else {
      console.log(`  = akun ${u.email} sudah ada`);
    }

    for (const role of u.roles) {
      const has = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(and(eq(userRoles.userId, id), eq(userRoles.role, role)));
      if (has.length === 0) {
        await db.insert(userRoles).values({ userId: id, role });
        console.log(`    · peran ${role} ditambahkan`);
      }
    }
  }
  console.log(`Selesai. Password demo: ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
