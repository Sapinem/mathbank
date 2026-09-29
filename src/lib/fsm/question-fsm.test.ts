import { describe, it, expect } from "vitest";
import {
  canTransition,
  nextStatuses,
  transition,
  InvalidTransitionError,
  NotReadyError,
  canBeReady,
  assertReady,
  isAnswerKeyEmpty,
  QUESTION_STATUSES,
} from "./question-fsm";

describe("question-fsm", () => {
  it("punya 4 status", () => {
    expect(QUESTION_STATUSES).toEqual(["draft", "review", "ready", "archived"]);
  });

  it("transisi sah: draft→review→ready→archived", () => {
    expect(canTransition("draft", "review")).toBe(true);
    expect(canTransition("review", "ready")).toBe(true);
    expect(canTransition("ready", "archived")).toBe(true);
    expect(canTransition("archived", "draft")).toBe(true);
  });

  it("reject: review→draft diizinkan (dikembalikan)", () => {
    expect(canTransition("review", "draft")).toBe(true);
  });

  it("transisi tak sah ditolak", () => {
    expect(canTransition("draft", "ready")).toBe(false);
    expect(canTransition("draft", "archived" as never)).toBe(true); // draft→archive sah
    expect(canTransition("ready", "draft")).toBe(false);
  });

  it("transition() idempoten bila from === to", () => {
    expect(transition("ready", "ready")).toBe("ready");
  });

  it("transition() melempar pada transisi tak sah", () => {
    expect(() => transition("draft", "ready")).toThrow(InvalidTransitionError);
  });

  it("nextStatuses mengembalikan tujuan yang sah", () => {
    expect(nextStatuses("draft")).toEqual(["review", "archived"]);
    expect(nextStatuses("archived")).toEqual(["draft"]);
  });

  it("tak ada transisi ke status tak dikenal", () => {
    for (const from of QUESTION_STATUSES) {
      for (const to of nextStatuses(from)) {
        expect(QUESTION_STATUSES).toContain(to);
      }
    }
  });

  it("dari status tak dikenal → tak ada transisi (fallback aman)", () => {
    expect(canTransition("ngawur" as never, "review")).toBe(false);
    expect(nextStatuses("ngawur" as never)).toEqual([]);
  });
});

describe("kesiapan (readiness) — boleh dibuat tanpa answer_key", () => {
  it("soal biasa tanpa answer_key BOLEH ada, tapi TIDAK bisa ready", () => {
    expect(canBeReady({ questionType: "single_choice", answerKey: {} })).toBe(
      false,
    );
    expect(canBeReady({ questionType: "single_choice", answerKey: null })).toBe(
      false,
    );
  });

  it("soal biasa dengan answer_key terisi BISA ready", () => {
    expect(
      canBeReady({ questionType: "single_choice", answerKey: { correct: "A" } }),
    ).toBe(true);
  });

  it("stimulus SELALU bisa ready (tak punya jawaban sendiri)", () => {
    expect(canBeReady({ questionType: "stimulus", answerKey: {} })).toBe(true);
    expect(canBeReady({ questionType: "stimulus", answerKey: null })).toBe(true);
  });

  it("isAnswerKeyEmpty mendeteksi {} dan null", () => {
    expect(isAnswerKeyEmpty({})).toBe(true);
    expect(isAnswerKeyEmpty(null)).toBe(true);
    expect(isAnswerKeyEmpty({ correct: "A" })).toBe(false);
  });

  it("assertReady melempar NotReadyError bila kosong", () => {
    expect(() =>
      assertReady({ questionType: "short_answer", answerKey: {} }),
    ).toThrow(NotReadyError);
  });

  it("assertReady LULUS untuk stimulus & soal berjawaban", () => {
    expect(() =>
      assertReady({ questionType: "stimulus", answerKey: {} }),
    ).not.toThrow();
    expect(() =>
      assertReady({ questionType: "short_answer", answerKey: { value: 42 } }),
    ).not.toThrow();
  });
});
