import { headers } from "next/headers";
import { auth } from "./server";
import type { Role } from "./roles";
import { isRole } from "./roles";

/**
 * Sesi NYATA pengguna (cookie better-auth) untuk komponen server.
 *
 * Beda dengan `resolveActor`: di sini **dev bypass TIDAK dihitung**. Dipakai
 * oleh guard layout agar pengguna benar-benar memilih peran di `/login`, bukan
 * diam-diam jadi admin lewat bypass.
 *
 * Mengembalikan null bila tak ada sesi valid.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  mustChangePassword: boolean;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    if (!session?.user) return null;
    const u = session.user as unknown as {
      id: string;
      name: string;
      email: string;
      roles?: string[];
      mustChangePassword?: boolean;
    };
    // Peran mungkin ada di sesi (bila dodat) — fallback ke kosong; guard hanya
    // butuh "ada sesi", peran detail dibaca lewat API /api/auth/me.
    const roles = Array.isArray(u.roles) ? u.roles.filter(isRole) : [];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      roles,
      mustChangePassword: u.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}
