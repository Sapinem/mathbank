import { describe, it, expect } from "vitest";
import {
  canTransition,
  nextStatuses,
  transition,
  InvalidTransitionError,
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
});
