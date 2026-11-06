import { describe, it, expect } from "vitest";
import {
  bundlePrintConfigSchema,
  createBundleSchema,
  updateBundleSchema,
} from "./bundle";

describe("bundlePrintConfigSchema", () => {
  it("lolos validasi dengan payload warisan tanpa themeId dan themeOptions", () => {
    const legacy = {
      institutionName: "SMP Negeri 1",
      twoColumnLayout: true,
      includeAnswerKey: false,
      pageSize: "A4" as const,
      answerSpaceCm: 3,
    };
    const parsed = bundlePrintConfigSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.themeId).toBeUndefined();
      expect(parsed.data.themeOptions).toBeUndefined();
    }
  });

  it("lolos validasi dengan themeId dan themeOptions valid", () => {
    const config = {
      institutionName: "SMA Nusantara",
      themeId: "formal-exam",
      themeOptions: {
        "formal-exam": {
          showSupervisorSignature: true,
          examType: "Penilaian Akhir Semester",
        },
      },
    };
    const parsed = bundlePrintConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.themeId).toBe("formal-exam");
      expect(parsed.data.themeOptions).toEqual({
        "formal-exam": {
          showSupervisorSignature: true,
          examType: "Penilaian Akhir Semester",
        },
      });
    }
  });

  it("melakukan trim pada themeId", () => {
    const config = {
      themeId: "   formal-exam   ",
    };
    const parsed = bundlePrintConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.themeId).toBe("formal-exam");
    }
  });

  it("menolak themeId berupa string kosong", () => {
    const config = {
      themeId: "",
    };
    const parsed = bundlePrintConfigSchema.safeParse(config);
    expect(parsed.success).toBe(false);
  });

  it("menolak themeOptions jika bukan objek peta record", () => {
    const config = {
      themeId: "formal-exam",
      themeOptions: "bukan-objek",
    };
    const parsed = bundlePrintConfigSchema.safeParse(config);
    expect(parsed.success).toBe(false);
  });

  it("berfungsi di dalam createBundleSchema dan updateBundleSchema", () => {
    const createPayload = {
      title: "Latihan Aljabar",
      bundleType: "exam" as const,
      printConfig: {
        themeId: "formal-exam",
        themeOptions: {
          "formal-exam": { showSupervisorSignature: true },
        },
      },
    };
    const createParsed = createBundleSchema.safeParse(createPayload);
    expect(createParsed.success).toBe(true);

    const updatePayload = {
      printConfig: {
        themeId: "math-my-id",
        themeOptions: {},
      },
    };
    const updateParsed = updateBundleSchema.safeParse(updatePayload);
    expect(updateParsed.success).toBe(true);
  });
});
