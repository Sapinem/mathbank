import { wrapRoute } from "@/lib/api/route-wrapper";
import { listGrades } from "@/lib/services/taxonomy-service";

/** GET /api/grades — daftar jenjang/kelas (referensi baca-saja, untuk editor & filter). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async () => listGrades(),
});
