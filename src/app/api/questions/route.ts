import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  listQuestionsQuerySchema,
  createQuestionSchema,
} from "@/lib/contracts/question";
import { listQuestions, createQuestion } from "@/lib/services/question-service";

/** GET /api/questions — daftar soal (filter + paginasi). */
export const GET = wrapRoute({
  permission: "question:view",
  query: listQuestionsQuerySchema,
  handler: async ({ query }) => listQuestions(query),
});

/** POST /api/questions — buat soal baru. */
export const POST = wrapRoute({
  permission: "question:create",
  body: createQuestionSchema,
  status: 201,
  handler: async ({ body, actor }) => createQuestion(body, actor),
});
