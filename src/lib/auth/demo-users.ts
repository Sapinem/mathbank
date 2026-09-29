/**
 * Akun DEMO untuk login cepat (dev/demo saja).
 *
 * Dipakai oleh:
 *  - `scripts/seed-users.ts` (membuat akun + peran di DB)
 *  - `/api/dev/quick-login` (menandatangani session untuk akun demo)
 *
 * ⚠️ Modul ini HANYA untuk dev/demo. Route quick-login punya pagar keras:
 * mati total bila NODE_ENV=production.
 */
import type { Role } from "./roles";

export const DEMO_PASSWORD = "demo-mathbank";

export interface DemoUser {
  /** Kunci stabil untuk URL/route. */
  key: string;
  email: string;
  name: string;
  roles: Role[];
  /** Deskripsi singkat untuk kartu login. */
  description: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    key: "admin",
    email: "admin@mathbank.local",
    name: "Admin Demo",
    roles: ["admin"],
    description: "Akses penuh: kelola semua soal, taksonomi, pengaturan.",
  },
  {
    key: "guru",
    email: "guru@mathbank.local",
    name: "Guru Demo",
    roles: ["teacher"],
    description: "Buat & sunting soal, kirim ke telaah. Tak boleh memutuskan telaah.",
  },
  {
    key: "penelaah",
    email: "penelaah@mathbank.local",
    name: "Penelaah Demo",
    roles: ["reviewer"],
    description: "Menelaah soal: setujui, tolak, atau lepas tanda.",
  },
];

export function demoUserByKey(key: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.key === key);
}
