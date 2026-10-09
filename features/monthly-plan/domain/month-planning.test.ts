import { describe, expect, it } from "vitest";
import { applicableIncome, calculateMonthContributions, resolveApplicableTemplateId } from "./month-planning";
import type { MonthlyPlanEntryView, PersonIncome } from "./types";

const JOAO = "joao";
const NATCH = "natch";
const JOINT_OWNER = null;

function entry(overrides: Partial<MonthlyPlanEntryView> & Pick<MonthlyPlanEntryView, "planned" | "actual" | "accountOwnerPersonId">): MonthlyPlanEntryView {
  return { id: Math.random().toString(36).slice(2), categoryId: "c", categoryName: "Categoria", categoryType: "VARIABLE", accountId: "a", accountName: "Conta", ...overrides };
}

const incomes: PersonIncome[] = [
  { id: "i1", personId: JOAO, amount: 2500, validFrom: "2026-01-01" },
  { id: "i2", personId: NATCH, amount: 2000, validFrom: "2026-01-01" },
];

// Exemplo do enunciado: Casa 1000 + Supermercado 400 + Internet 100 (conjunta) + Restaurante 200 (João) = 1700
const plannedEntries = [
  entry({ planned: 1000, actual: 1000, accountOwnerPersonId: JOINT_OWNER }),
  entry({ planned: 400, actual: 380, accountOwnerPersonId: JOINT_OWNER }),
  entry({ planned: 100, actual: 100, accountOwnerPersonId: JOINT_OWNER }),
  entry({ planned: 200, actual: 180, accountOwnerPersonId: JOAO }),
];

describe("resolveApplicableTemplateId", () => {
  const templates = [
    { id: "A", validFrom: "2026-01" },
    { id: "B", validFrom: "2026-05" },
  ];

  it("uses the latest template whose validFrom is not after the month", () => {
    expect(resolveApplicableTemplateId(templates, "2026-03")).toBe("A");
    expect(resolveApplicableTemplateId(templates, "2026-05")).toBe("B");
    expect(resolveApplicableTemplateId(templates, "2026-08")).toBe("B");
  });

  it("returns null when no template applies yet", () => {
    expect(resolveApplicableTemplateId(templates, "2025-12")).toBeNull();
  });
});

describe("applicableIncome", () => {
  it("ignores incomes that start after the month", () => {
    const withRaise: PersonIncome[] = [...incomes, { id: "i3", personId: JOAO, amount: 2680, validFrom: "2026-05-01" }];
    expect(applicableIncome(withRaise, JOAO, "2026-04")).toBe(2500);
    expect(applicableIncome(withRaise, JOAO, "2026-05")).toBe(2680);
  });
});

describe("calculateMonthContributions", () => {
  it("splits the total actual proportionally to income and settles in two directions", () => {
    const result = calculateMonthContributions({ month: "2026-09", entries: plannedEntries, personIds: [JOAO, NATCH], incomes });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    // Actual total: 1000 + 380 + 100 + 180 = 1660 (planeado 1700 é ignorado).
    expect(result.contributionRequired).toBeCloseTo(1660);
    const joao = result.people.find((person) => person.personId === JOAO)!;
    const natch = result.people.find((person) => person.personId === NATCH)!;
    expect(joao.quota).toBeCloseTo(1660 * 2500 / 4500);
    expect(joao.personalActual).toBe(180);
    expect(joao.transferToJoint).toBeCloseTo(1660 * 2500 / 4500 - 180);
    expect(joao.transferToPerson).toBe(0);
    expect(natch.quota).toBeCloseTo(1660 * 2000 / 4500);
    expect(natch.personalActual).toBe(0);
    expect(natch.transferToJoint).toBeCloseTo(1660 * 2000 / 4500);
    expect(natch.transferToPerson).toBe(0);
  });

  it("does not reduce transfers with joint account expenses", () => {
    // Actual conjunto: 1000 + 380 + 100 = 1480 → quotas 1480 × share. Gastos conjuntos (actual) não reduzem nada.
    const jointOnly = plannedEntries.filter((item) => item.accountOwnerPersonId === JOINT_OWNER);
    const result = calculateMonthContributions({ month: "2026-09", entries: jointOnly, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.contributionRequired).toBeCloseTo(1480);
    expect(result.people.find((person) => person.personId === JOAO)!.transferToJoint).toBeCloseTo(1480 * 2500 / 4500);
    expect(result.people.find((person) => person.personId === NATCH)!.transferToJoint).toBeCloseTo(1480 * 2000 / 4500);
    expect(result.people.every((person) => person.personalActual === 0)).toBe(true);
    expect(result.people.every((person) => person.transferToPerson === 0)).toBe(true);
  });

  it("only the actual personal expense reduces the transfer, never the planned one", () => {
    const entries = [entry({ planned: 300, actual: 200, accountOwnerPersonId: JOAO })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.people.find((person) => person.personId === JOAO)!.personalActual).toBe(200);
  });

  it("never returns a negative transfer and pays back overpayment via transferToPerson", () => {
    const entries = [entry({ planned: 100, actual: 5000, accountOwnerPersonId: JOAO })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    const joao = result.people.find((person) => person.personId === JOAO)!;
    expect(joao.transferToJoint).toBe(0);
    expect(joao.transferToPerson).toBeCloseTo(5000 - 5000 * 2500 / 4500);
  });

  it("settles the task example: 2400 actual with equal shares", () => {
    const equalIncomes: PersonIncome[] = [
      { id: "e1", personId: JOAO, amount: 2000, validFrom: "2026-01-01" },
      { id: "e2", personId: NATCH, amount: 2000, validFrom: "2026-01-01" },
    ];
    const entries = [
      entry({ planned: 2400, actual: 1400, accountOwnerPersonId: JOAO }),
      entry({ planned: 0, actual: 200, accountOwnerPersonId: NATCH }),
      entry({ planned: 0, actual: 800, accountOwnerPersonId: JOINT_OWNER }),
    ];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes: equalIncomes });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.contributionRequired).toBeCloseTo(2400);
    const joao = result.people.find((person) => person.personId === JOAO)!;
    const natch = result.people.find((person) => person.personId === NATCH)!;
    expect(joao.quota).toBeCloseTo(1200);
    expect(joao.transferToJoint).toBe(0);
    expect(joao.transferToPerson).toBeCloseTo(200);
    expect(natch.quota).toBeCloseTo(1200);
    expect(natch.transferToJoint).toBeCloseTo(1000);
    expect(natch.transferToPerson).toBe(0);
  });

  it("bases the settlement on actual expenses, not on the budget", () => {
    // Same planned budget (2000) in both cases; settlement follows actual (1500 vs 2500).
    const under = [
      entry({ planned: 1000, actual: 1000, accountOwnerPersonId: JOINT_OWNER }),
      entry({ planned: 1000, actual: 500, accountOwnerPersonId: JOINT_OWNER }),
    ];
    const over = [
      entry({ planned: 1000, actual: 1000, accountOwnerPersonId: JOINT_OWNER }),
      entry({ planned: 1000, actual: 1500, accountOwnerPersonId: JOINT_OWNER }),
    ];
    const underResult = calculateMonthContributions({ month: "2026-09", entries: under, personIds: [JOAO, NATCH], incomes });
    const overResult = calculateMonthContributions({ month: "2026-09", entries: over, personIds: [JOAO, NATCH], incomes });
    if (underResult.status !== "ok" || overResult.status !== "ok") throw new Error("expected ok");
    expect(underResult.contributionRequired).toBeCloseTo(1500);
    expect(overResult.contributionRequired).toBeCloseTo(2500);
    expect(underResult.people.find((p) => p.personId === JOAO)!.transferToJoint).toBeCloseTo(1500 * 2500 / 4500);
    expect(overResult.people.find((p) => p.personId === JOAO)!.transferToJoint).toBeCloseTo(2500 * 2500 / 4500);
  });

  it("returns an explicit error instead of NaN or Infinity when there is no income", () => {
    const result = calculateMonthContributions({ month: "2026-09", entries: plannedEntries, personIds: [JOAO, NATCH], incomes: [] });
    expect(result.status).toBe("no-income");
  });
});
