import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";

/**
 * MAT-39: `/api/collections/[id]/items` DIHAPUS — wadah naskah digabung ke `bundles`.
 * Gunakan `/api/bundles/[id]/items` sebagai pengganti.
 */
class ResourceGoneError extends Error {
  httpStatus = 410;
  code = "RESOURCE_GONE";
  constructor(message: string) {
    super(message);
    this.name = "ResourceGoneError";
  }
}

const paramsSchema = z.object({ id: z.string() });
const querySchema = z.object({}).passthrough().optional();

const goneHandler = async () => {
  throw new ResourceGoneError(
    "Collections API has been removed. Use /api/bundles/[id]/items instead.",
  );
};

export const GET = wrapRoute({ auth: false, params: paramsSchema, query: querySchema, handler: goneHandler });
export const POST = wrapRoute({ auth: false, params: paramsSchema, query: querySchema, handler: goneHandler });
export const PUT = wrapRoute({ auth: false, params: paramsSchema, query: querySchema, handler: goneHandler });
export const DELETE = wrapRoute({ auth: false, params: paramsSchema, query: querySchema, handler: goneHandler });
