/**
 * Layanan soal (M14) — **barrel** untuk kompatibilitas impor.
 *
 * Semula 502 baris; dipecah per-operasi agar tiap modul fokus & mudah diuji:
 *  - `question-read.ts`   → baca + proyeksi aman (S3): getQuestion, getQuestionInternal, listQuestions
 *  - `question-write.ts`  → mutasi non-status: createQuestion, updateQuestion, setQuestionFlag, deleteQuestion, hardDeleteQuestion
 *  - `question-status.ts` → transisi status (FSM + izin + penjagaan balapan)
 *
 * Impor lama (`@/lib/services/question-service`) tetap bekerja — tak ada
 * perubahan di call-site. Impor spesifik boleh diarahkan ke modul baru bila
 * ingin lebih jelas.
 */

export {
  getQuestion,
  getQuestionInternal,
  listQuestions,
  type PublicQuestion,
  type QuestionInternal,
} from "./question-read";

export {
  createQuestion,
  updateQuestion,
  setQuestionFlag,
  deleteQuestion,
  hardDeleteQuestion,
} from "./question-write";

export { changeQuestionStatus } from "./question-status";

export {
  bulkQuestionAction,
  BULK_ACTIONS,
  BULK_MAX_IDS,
  type BulkAction,
  type BulkResult,
} from "./question-bulk";
