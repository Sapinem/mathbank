import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  listQuestionsQuerySchema,
  createQuestionSchema,
} from "@/lib/contracts/question";
import { listQuestions, createQuestion } from "@/lib/services/question-service";

/** GET /api/questions — daftar soal (filter + paginasi). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  query: listQuestionsQuerySchema,
  handler: async ({ query, actor }) => listQuestions(query, actor),
});

/** POST /api/questions — buat soal baru. */
export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 }, // ~20 burst, 30/menit
  permission: "question:create",
  body: createQuestionSchema,
  status: 201,
  handler: async ({ body, actor }) => createQuestion(body, actor),
});
