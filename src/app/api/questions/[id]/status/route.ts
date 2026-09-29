import { wrapRoute } from "@/lib/api/route-wrapper";
import { changeStatusSchema } from "@/lib/contracts/question";
import { changeQuestionStatus } from "@/lib/services/question-service";

/** PATCH /api/questions/[id]/status — ubah status lewat FSM (L6). */
export const PATCH = wrapRoute({
  permission: "question:edit",
  body: changeStatusSchema,
  handler: async ({ params, body, actor }) =>
    changeQuestionStatus(params.id, body.status, actor),
});
