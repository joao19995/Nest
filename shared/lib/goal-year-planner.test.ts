import { describe, expect, it } from "vitest";
import { buildYearSeeds, computeAdjustRecalc } from "./goal-year-planner";
import type { GoalTemplate } from "../../features/goals/domain/goal-template";

const templateJan: GoalTemplate = {
  id: "t1",
  validFrom: "2026-01",
  annualTotal: 0,
  entries: [
    { goalId: "a", percentage: 60 },
    { goalId: "b", percentage: 40 },
  ],
};

const templateJul: GoalTemplate = {
  id: "t2",
  validFrom: "2026-07",
  annualTotal: 0,
  entries: [
    { goalId: "a", percentage: 50 },
    { goalId: "b", percentage: 50 },
  ],
};

describe("buildYearSeeds", () => {
  it("resolve a versao aplicavel a cada mes", () => {
    const { seeds, missingMonths } = buildYearSeeds({
      year: 2026,
      funding: [
        { month: "2026-03", available: 1000 },
        { month: "2026-09", available: 1000 },
      ],
      templates: [templateJan, templateJul],
    });
    expect(missingMonths).toEqual([]);
    expect(seeds).toHaveLength(2);
    expect(seeds[0].allocations).toEqual([
      { goalId: "a", planned: 600 },
      { goalId: "b", planned: 400 },
    ]);
    expect(seeds[1].allocations).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
  });

  it("reporta meses sem template em vez de inventar distribuicao", () => {
    const { seeds, missingMonths } = buildYearSeeds({
      year: 2026,
      funding: [{ month: "2026-03", available: 1000 }],
      templates: [],
    });
    expect(seeds).toEqual([]);
    expect(missingMonths).toEqual(["2026-03"]);
  });
});

describe("computeAdjustRecalc", () => {
  const storedPlans = [
    { planId: "p1", month: "2026-01", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p2", month: "2026-02", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p3", month: "2026-03", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
  ];
  const fundingByMonth = new Map([
    ["2026-01", 1000],
    ["2026-02", 1000],
    ["2026-03", 1200],
  ]);

  it("preserva meses fechados e recalcula so futuros meses abertos", () => {
    const { toApply, futureChanges, missingMonths } = computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 700 }, { goalId: "b", planned: 300 }],
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
    });
    // Mês alvo com os valores do utilizador + março recalculado (disponível mudou).
    expect(toApply.map((item) => item.planId).sort()).toEqual(["p2", "p3"]);
    expect(toApply.find((item) => item.planId === "p2")!.allocations).toEqual([
      { goalId: "a", planned: 700 },
      { goalId: "b", planned: 300 },
    ]);
    expect(toApply.find((item) => item.planId === "p3")!.allocations).toEqual([
      { goalId: "a", planned: 720 },
      { goalId: "b", planned: 480 },
    ]);
    expect(futureChanges.map((item) => item.month)).toEqual(["2026-03"]);
    expect(missingMonths).toEqual([]);
  });

  it("nao altera o template ao ajustar o mes", () => {
    const snapshot = JSON.parse(JSON.stringify([templateJan]));
    computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 1000 }, { goalId: "b", planned: 0 }],
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
    });
    expect([templateJan]).toEqual(snapshot);
  });

  it("sem mudancas futuras nao propoe recalculos", () => {
    const { toApply, futureChanges } = computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }],
      storedPlans,
      fundingByMonth: new Map([["2026-02", 1000], ["2026-03", 1000]]),
      templates: [templateJan],
    });
    expect(toApply.map((item) => item.planId)).toEqual(["p2"]);
    expect(futureChanges).toEqual([]);
  });
});
