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
  it("uses planned total when actual is below the planned total", () => {
    // Exemplo 1: planeado 1357; actual 584 → base 1357.
    const entries = [entry({ planned: 1357, actual: 584, accountOwnerPersonId: JOINT_OWNER })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.contributionRequired).toBeCloseTo(1357);
    const joao = result.people.find((person) => person.personId === JOAO)!;
    const natch = result.people.find((person) => person.personId === NATCH)!;
    expect(joao.quota).toBeCloseTo(1357 / 2);
    expect(natch.quota).toBeCloseTo(1357 / 2);
    expect(joao.transferToJoint).toBeCloseTo(joao.quota);
    expect(joao.transferToPerson).toBe(0);
  });

  it("uses actual when it is above planned", () => {
    const entries = [entry({ planned: 1000, actual: 1050, accountOwnerPersonId: JOINT_OWNER })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.contributionRequired).toBeCloseTo(1050);
    expect(result.people.find((person) => person.personId === JOAO)!.quota).toBeCloseTo(525);
    expect(result.people.find((person) => person.personId === NATCH)!.quota).toBeCloseTo(525);
  });

  it("uses actual expenses when they exceed the planned total", () => {
    // Exemplo 2: planeado 1357; actual 1600 → base 1600.
    const entries = [entry({ planned: 1357, actual: 1600, accountOwnerPersonId: JOINT_OWNER })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.contributionRequired).toBeCloseTo(1600);
    expect(result.people.find((person) => person.personId === JOAO)!.quota).toBeCloseTo(800);
    expect(result.people.find((person) => person.personId === NATCH)!.quota).toBeCloseTo(800);
    expect(result.people.find((person) => person.personId === JOAO)!.transferToJoint).toBeCloseTo(800);
  });

  it("splits the base equally and settles in two directions", () => {
    // Planeado 1700; actual 1660 → base 1700.
    const result = calculateMonthContributions({ month: "2026-09", entries: plannedEntries, personIds: [JOAO, NATCH], incomes });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.contributionRequired).toBeCloseTo(1700);
    const joao = result.people.find((person) => person.personId === JOAO)!;
    const natch = result.people.find((person) => person.personId === NATCH)!;
    expect(joao.quota).toBeCloseTo(850);
    expect(joao.personalActual).toBe(180);
    expect(joao.transferToJoint).toBeCloseTo(850 - 180);
    expect(joao.transferToPerson).toBe(0);
    expect(natch.quota).toBeCloseTo(850);
    expect(natch.personalActual).toBe(0);
    expect(natch.transferToJoint).toBeCloseTo(850);
    expect(natch.transferToPerson).toBe(0);
  });

  it("does not reduce transfers with joint account expenses", () => {
    // Planeado conjunto: 1000 + 400 + 100 = 1500; actual 1480 → base 1500.
    const jointOnly = plannedEntries.filter((item) => item.accountOwnerPersonId === JOINT_OWNER);
    const result = calculateMonthContributions({ month: "2026-09", entries: jointOnly, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.contributionRequired).toBeCloseTo(1500);
    expect(result.people.find((person) => person.personId === JOAO)!.transferToJoint).toBeCloseTo(750);
    expect(result.people.find((person) => person.personId === NATCH)!.transferToJoint).toBeCloseTo(750);
    expect(result.people.every((person) => person.personalActual === 0)).toBe(true);
    expect(result.people.every((person) => person.transferToPerson === 0)).toBe(true);
  });

  it("only the actual personal expense reduces the transfer, never the planned one", () => {
    // Planeado 300; actual 200 → base 300; personalActual 200.
    const entries = [entry({ planned: 300, actual: 200, accountOwnerPersonId: JOAO })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    const joao = result.people.find((person) => person.personId === JOAO)!;
    expect(joao.personalActual).toBe(200);
    expect(joao.quota).toBeCloseTo(150);
    expect(joao.transferToJoint).toBe(0);
    expect(joao.transferToPerson).toBeCloseTo(50);
  });

  it("never returns a negative transfer and pays back overpayment via transferToPerson", () => {
    const entries = [entry({ planned: 100, actual: 5000, accountOwnerPersonId: JOAO })];
    const result = calculateMonthContributions({ month: "2026-09", entries, personIds: [JOAO, NATCH], incomes });
    if (result.status !== "ok") throw new Error("expected ok");
    const joao = result.people.find((person) => person.personId === JOAO)!;
    expect(joao.transferToJoint).toBe(0);
    expect(joao.transferToPerson).toBeCloseTo(2500);
  });

  it("settles with equal shares when the base is the actual total", () => {
    const equalIncomes: PersonIncome[] = [
      { id: "e1", personId: JOAO, amount: 2000, validFrom: "2026-01-01" },
      { id: "e2", personId: NATCH, amount: 2000, validFrom: "2026-01-01" },
    ];
    // Planeado 0 → base = actual 2400; a despesa conjunta conta no total sem ser crédito pessoal.
    const entries = [
      entry({ planned: 0, actual: 1400, accountOwnerPersonId: JOAO }),
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

  it("uses actual expenses only when they exceed the planned total", () => {
    // Planeado 2000; actual abaixo (1500) usa 2000, actual acima (2500) usa 2500.
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
    expect(underResult.contributionRequired).toBeCloseTo(2000);
    expect(overResult.contributionRequired).toBeCloseTo(2500);
    expect(underResult.people.find((p) => p.personId === JOAO)!.transferToJoint).toBeCloseTo(1000);
    expect(overResult.people.find((p) => p.personId === JOAO)!.transferToJoint).toBeCloseTo(1250);
  });

  it("reports joint surplus as base minus actual, never negative, and does not change transfers", () => {
    // Planeado 1500 (conjunta), actual 1480 → base 1500, lucro conjunta 20.
    const jointOnly = plannedEntries.filter((item) => item.accountOwnerPersonId === JOINT_OWNER);
    const under = calculateMonthContributions({ month: "2026-09", entries: jointOnly, personIds: [JOAO, NATCH], incomes });
    if (under.status !== "ok") throw new Error("expected ok");
    expect(under.jointSurplus).toBeCloseTo(20);
    expect(under.people.find((p) => p.personId === JOAO)!.transferToJoint).toBeCloseTo(750);

    // Actual acima do planeado → base = actual → lucro 0 (nunca negativo).
    const over = [entry({ planned: 1000, actual: 1200, accountOwnerPersonId: JOINT_OWNER })];
    const overResult = calculateMonthContributions({ month: "2026-09", entries: over, personIds: [JOAO, NATCH], incomes });
    if (overResult.status !== "ok") throw new Error("expected ok");
    expect(overResult.jointSurplus).toBe(0);
  });

  it("returns an explicit error instead of NaN or Infinity when there is no income", () => {
    const result = calculateMonthContributions({ month: "2026-09", entries: plannedEntries, personIds: [JOAO, NATCH], incomes: [] });
    expect(result.status).toBe("no-income");
  });
});
