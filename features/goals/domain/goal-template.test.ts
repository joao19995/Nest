import { describe, expect, it } from "vitest";
import { annualAmountsFor, isValidTemplateTotal, suggestMonthlyFromTemplate, totalPercentage } from "./goal-template";

describe("goal-template", () => {
  it("exige que a tabela some 100%", () => {
    expect(isValidTemplateTotal([{ percentage: 60 }, { percentage: 40 }])).toBe(true);
    expect(isValidTemplateTotal([{ percentage: 60 }, { percentage: 30 }])).toBe(false);
    expect(totalPercentage([{ percentage: 50 }, { percentage: 50 }])).toBeCloseTo(100);
  });

  it("deriva o montante anual da percentagem", () => {
    expect(annualAmountsFor(12000, [
      { goalId: "a", percentage: 25, priority: "HIGH", deadlineMonth: null },
      { goalId: "b", percentage: 75, priority: "LOW", deadlineMonth: null },
    ])).toEqual([
      { goalId: "a", amount: 3000 },
      { goalId: "b", amount: 9000 },
    ]);
  });

  it("distribui o disponível do mês pelas percentagens e ignora prazos vencidos", () => {
    const result = suggestMonthlyFromTemplate({
      availableAmount: 1505,
      entries: [
        { goalId: "brasil", percentage: 60, priority: "HIGH", deadlineMonth: null },
        { goalId: "velho", percentage: 40, priority: "LOW", deadlineMonth: "2026-01" },
      ],
      month: "2026-03",
    });
    expect(result.suggestions).toEqual([{ goalId: "brasil", planned: 903 }]);
    expect(result.undistributed).toBeCloseTo(602);
  });
});
