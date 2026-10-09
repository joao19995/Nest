import { describe, expect, it } from "vitest";
import { isValidTemplateTotal, resolveApplicableGoalTemplate, resolveApplicableGoalTemplateId, totalPercentage } from "./goal-template";

describe("goal-template", () => {
  it("exige que a tabela some 100%", () => {
    expect(isValidTemplateTotal([{ percentage: 60 }, { percentage: 40 }])).toBe(true);
    expect(isValidTemplateTotal([{ percentage: 60 }, { percentage: 30 }])).toBe(false);
    expect(totalPercentage([{ percentage: 50 }, { percentage: 50 }])).toBeCloseTo(100);
  });

  it("tolera pequenos arredondamentos no total", () => {
    expect(isValidTemplateTotal([{ percentage: 33.33 }, { percentage: 33.33 }, { percentage: 33.34 }])).toBe(true);
    expect(isValidTemplateTotal([{ percentage: 50 }, { percentage: 49.9 }])).toBe(false);
  });

  it("resolve a versao aplicavel pelo mes de inicio", () => {
    const templates = [
      { id: "jan", validFrom: "2026-01" },
      { id: "jul", validFrom: "2026-07" },
    ];
    expect(resolveApplicableGoalTemplateId(templates, "2026-03")).toBe("jan");
    expect(resolveApplicableGoalTemplateId(templates, "2026-07")).toBe("jul");
    expect(resolveApplicableGoalTemplateId(templates, "2026-12")).toBe("jul");
    expect(resolveApplicableGoalTemplateId(templates, "2025-12")).toBeNull();
    expect(resolveApplicableGoalTemplate(templates, "2026-05")).toEqual({ id: "jan", validFrom: "2026-01" });
  });
});
