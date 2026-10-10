import { describe, expect, it } from "vitest";
import { findDeactivationBlockers, isValidTemplateTotal, resolveApplicableGoalTemplate, totalPercentage } from "./goal-template";

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
    expect(resolveApplicableGoalTemplate(templates, "2026-05")).toEqual({ id: "jan", validFrom: "2026-01" });
  });
});

describe("findDeactivationBlockers", () => {
  const fundedJan = {
    id: "t1", validFrom: "2026-01", annualTotal: 0,
    entries: [{ goalId: "a", percentage: 60 }, { goalId: "b", percentage: 40 }],
  };
  const fundedJul = {
    id: "t2", validFrom: "2026-07", annualTotal: 0,
    entries: [{ goalId: "a", percentage: 50 }, { goalId: "b", percentage: 50 }],
  };
  const unfundedJul = {
    id: "t2", validFrom: "2026-07", annualTotal: 0,
    entries: [{ goalId: "b", percentage: 100 }],
  };

  it("bloqueia a versao que se aplica a meses abertos", () => {
    const blockers = findDeactivationBlockers({ goalId: "a", templates: [fundedJan, unfundedJul], openMonths: ["2026-03"] });
    expect(blockers.map((item) => item.id)).toEqual(["t1"]);
  });

  it("a ultima versao bloqueia mesmo sem meses abertos no seu alcance", () => {
    const unfundedJan = { ...unfundedJul, id: "t1", validFrom: "2026-01" };
    const blockers = findDeactivationBlockers({ goalId: "a", templates: [unfundedJan, fundedJul], openMonths: [] });
    expect(blockers.map((item) => item.id)).toEqual(["t2"]);
  });

  it("permite quando a versao com percentagem so rege meses fechados", () => {
    const blockers = findDeactivationBlockers({ goalId: "a", templates: [fundedJan, unfundedJul], openMonths: ["2026-08"] });
    expect(blockers).toEqual([]);
  });

  it("percentagem zero nunca bloqueia", () => {
    const zero = {
      id: "t1", validFrom: "2026-01", annualTotal: 0,
      entries: [{ goalId: "a", percentage: 0 }, { goalId: "b", percentage: 100 }],
    };
    expect(findDeactivationBlockers({ goalId: "a", templates: [zero], openMonths: ["2026-03"] })).toEqual([]);
  });

  it("sem templates nao ha bloqueio", () => {
    expect(findDeactivationBlockers({ goalId: "a", templates: [], openMonths: ["2026-03"] })).toEqual([]);
  });
});
