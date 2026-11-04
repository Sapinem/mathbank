import { describe, it, expect } from "vitest";
import { statusBadgeClass } from "./bundle-labels";

describe("statusBadgeClass", () => {
  it("mengembalikan kelas badge yang sesuai untuk setiap status paket", () => {
    expect(statusBadgeClass("ready")).toBe("border-success/30 bg-success/10 text-success");
    expect(statusBadgeClass("review")).toBe("border-gold/30 bg-gold/10 text-gold");
    expect(statusBadgeClass("draft")).toBe("border-border bg-muted/60 text-muted-foreground");
    expect(statusBadgeClass("archived")).toBe("border-border/60 bg-muted/30 text-muted-foreground/70");
    expect(statusBadgeClass("unknown")).toBe("");
  });
});
