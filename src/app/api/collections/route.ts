import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";

/**
 * MAT-39: `/api/collections` DIHAPUS — wadah naskah digabung ke `bundles`.
 * Gunakan `/api/bundles?bundleType=source` sebagai pengganti.
 */
class ResourceGoneError extends Error {
  httpStatus = 410;
  code = "RESOURCE_GONE";
  constructor(message: string) {
    super(message);
    this.name = "ResourceGoneError";
  }
}

const querySchema = z.object({}).passthrough().optional();

const goneHandler = async () => {
  throw new ResourceGoneError(
    "Collections API has been removed. Use /api/bundles?bundleType=source instead.",
  );
};

export const GET = wrapRoute({ auth: false, query: querySchema, handler: goneHandler });
export const POST = wrapRoute({ auth: false, query: querySchema, handler: goneHandler });
