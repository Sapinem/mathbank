import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { listGrades } from "@/lib/services/taxonomy-service";

const emptyQuerySchema = z.object({}).optional();

/** GET /api/grades — daftar jenjang/kelas (referensi baca-saja, untuk editor & filter). */
export const GET = wrapRoute({
  rateLimit: true,
  authz: { kind: "route", permission: "question:view" },
  query: emptyQuerySchema,
  handler: async () => listGrades(),
});
