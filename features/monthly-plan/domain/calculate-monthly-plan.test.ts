import { describe, expect, it } from "vitest";
import { exampleAnnualPlan, exampleConfiguration, exampleMonth } from "../data/example-month";
import { calculateMonthlyPlan, suggestGoalAllocations } from "./calculate-monthly-plan";
import type { CategoryTemplate, FinancialConfiguration } from "./types";
import { entitySeedIds } from "../../../shared/lib/entity-seed-ids";

describe("calculateMonthlyPlan", () => {
  it("uses the income period applicable to the selected month", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, { ...exampleMonth, month: "2026-01" });

    expect(result.incomeByPerson).toEqual([
      { personId: entitySeedIds.people.joao, amount: 2500 },
      { personId: entitySeedIds.people.natch, amount: 2000 },
    ]);
    expect(result.dailySpending).toBe(1125);
    expect(result.surplus).toBe(2375);
  });

  it("calculates the global emergency fund", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, exampleMonth);

    expect(result.emergencyFund).toBe(6000);
    expect(result.dailySpending).toBe(1170);
    // Template de exemplo: 1000 + 100 + 80 + 180 = 1360 → contribuição 1360
    expect(result.templateExpectedTotal).toBe(1360);
    expect(result.contributionRequired).toBeCloseTo(1360);
    expect(result.individualFixedTotal).toBeCloseTo(0);
    expect(result.individualFixedByPerson.find((item) => item.personId === entitySeedIds.people.joao)?.amount).toBeCloseTo(0);
    expect(result.individualFixedByPerson.find((item) => item.personId === entitySeedIds.people.natch)?.amount).toBeCloseTo(0);
    expect(result.surplusAfterTransfers).toBeCloseTo(1150);
    expect(result.goalAllocations).toEqual([]);
    expect(result.availableForGoals).toBeCloseTo(1150);
    expect(result.unallocatedForGoals).toBeCloseTo(1150);

    const nextMonth = { ...exampleMonth, month: "2026-11" };
    const nextResult = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, nextMonth);
    expect(nextResult.goalAllocations).toEqual([]);
    expect(suggestGoalAllocations(exampleConfiguration, exampleMonth.month, result.availableForGoals)).toEqual([{ month: "2026-10", goalId: "brazil", amount: result.availableForGoals }]);
  });

  it("calculates transfers from the template contribution and joint actual expenses", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, exampleMonth);
    expect(result.transfers[0]).toMatchObject({ personId: entitySeedIds.people.joao, accountId: entitySeedIds.accounts.joint, status: "calculated" });
    expect(result.transfers[0].minimumAmount).toBeCloseTo(680);
    expect(result.transfers[0].amount).toBeCloseTo(result.transfers[0].minimumAmount);
    expect(result.transfers[1].minimumAmount).toBeCloseTo(680);
    expect(result.transfers[1].amount).toBeCloseTo(result.transfers[1].minimumAmount);

    const highJointExpenses = { ...exampleMonth, expenses: [{ categoryId: entitySeedIds.categories.house, accountId: entitySeedIds.accounts.joint, planned: 1600, actual: 1600 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, highJointExpenses).totalJointExpenses).toBe(1600);
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, highJointExpenses).totalTransferRequirement).toBe(1600);
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, highJointExpenses).transfers.every((transfer) => transfer.status === "calculated")).toBe(true);

    const expensesAboveMinimum = { ...exampleMonth, expenses: [{ categoryId: entitySeedIds.categories.house, accountId: entitySeedIds.accounts.joint, planned: 2000, actual: 2000 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, expensesAboveMinimum).totalTransferRequirement).toBe(2000);
    const proportionalTransfers = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, expensesAboveMinimum).transfers;
    expect(proportionalTransfers.every((transfer) => transfer.status === "calculated")).toBe(true);
    expect(proportionalTransfers.reduce((sum, transfer) => sum + transfer.amount, 0)).toBeCloseTo(2000);
  });

  it("keeps bonuses out of day-to-day and sends them to Goals", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, { ...exampleMonth, month: "2026-06" });

    expect(result.totalIncome).toBe(4680);
    expect(result.totalBonus).toBe(4680);
    expect(result.dailySpending).toBe(1170);
    expect(result.availableForGoals).toBe(result.surplusAfterTransfers + result.totalBonus);
  });

  it("reads the user's annual plan instead of creating allocations automatically", () => {
    const annualPlan = { year: 2026, allocations: [{ month: "2026-10", goalId: "brazil", amount: 500 }] };
    const result = calculateMonthlyPlan(exampleConfiguration, annualPlan, exampleMonth);

    expect(result.goalAllocations).toEqual(annualPlan.allocations);
    expect(result.allocatedToGoals).toBe(500);
    expect(result.unallocatedForGoals).toBeCloseTo(650);
  });
});

const house = entitySeedIds.categories.house;
const car = entitySeedIds.categories.car;
const dog = entitySeedIds.categories.dog;
const joint = entitySeedIds.accounts.joint;

// Exemplo do enunciado: template 1800 €, rendimentos João 2500 € e Natch 2000 € (janeiro de 2026).
const specTemplate: CategoryTemplate = {
  id: "11111111-1111-4111-8111-111111111111",
  validFrom: "2026-01",
  entries: [
    { categoryId: house, accountId: joint, expectedAmount: 1000, active: true },
    { categoryId: car, accountId: joint, expectedAmount: 400, active: true },
    { categoryId: dog, accountId: joint, expectedAmount: 400, active: true },
  ],
};

function withTemplates(templates: CategoryTemplate[], overrides: Partial<FinancialConfiguration> = {}): FinancialConfiguration {
  return { ...exampleConfiguration, categoryTemplates: templates, ...overrides };
}

describe("monthly template contribution", () => {
  const january = { ...exampleMonth, month: "2026-01" };

  it("derives contributions from the template total split equally", () => {
    const result = calculateMonthlyPlan(withTemplates([specTemplate]), exampleAnnualPlan, january);

    expect(result.templateExpectedTotal).toBe(1800);
    expect(result.contributionRequired).toBeCloseTo(1800);
    expect(result.transfers.find((transfer) => transfer.personId === entitySeedIds.people.joao)?.minimumAmount).toBeCloseTo(900);
    expect(result.transfers.find((transfer) => transfer.personId === entitySeedIds.people.natch)?.minimumAmount).toBeCloseTo(900);
    expect(result.totalTransferRequirement).toBeCloseTo(1800);
    expect(result.individualFixedTotal).toBeCloseTo(0);
  });

  it("ignores inactive template entries", () => {
    const withInactive = { ...specTemplate, entries: [...specTemplate.entries, { categoryId: entitySeedIds.categories.extras, accountId: entitySeedIds.accounts.joao, expectedAmount: 500, active: false }] };
    const result = calculateMonthlyPlan(withTemplates([withInactive]), exampleAnnualPlan, january);

    expect(result.templateExpectedTotal).toBe(1800);
    expect(result.contributionRequired).toBeCloseTo(1800);
  });

  it("uses the template version applicable to each month and keeps older versions", () => {
    const newerTemplate: CategoryTemplate = { id: "22222222-2222-4222-8222-222222222222", validFrom: "2026-05", entries: [{ categoryId: house, accountId: joint, expectedAmount: 1000, active: true }] };
    const configuration = withTemplates([specTemplate, newerTemplate]);

    expect(calculateMonthlyPlan(configuration, exampleAnnualPlan, { ...exampleMonth, month: "2026-04" }).contributionRequired).toBeCloseTo(1800);
    expect(calculateMonthlyPlan(configuration, exampleAnnualPlan, { ...exampleMonth, month: "2026-05" }).contributionRequired).toBeCloseTo(1000);
    expect(calculateMonthlyPlan(configuration, exampleAnnualPlan, { ...exampleMonth, month: "2026-09" }).contributionRequired).toBeCloseTo(1000);
  });

  it("sums individual fixed amounts from the person field", () => {
    const configuration = withTemplates([specTemplate], {
      people: [
        { id: entitySeedIds.people.joao, name: "João", dailySpendingPercentage: 25, emergencyFundMonths: 6, individualFixedAmount: 200 },
        { id: entitySeedIds.people.natch, name: "Natch", dailySpendingPercentage: 25, emergencyFundMonths: 6, individualFixedAmount: 50 },
      ],
    });
    const result = calculateMonthlyPlan(configuration, exampleAnnualPlan, january);

    expect(result.individualFixedByPerson.find((item) => item.personId === entitySeedIds.people.joao)?.amount).toBeCloseTo(200);
    expect(result.individualFixedByPerson.find((item) => item.personId === entitySeedIds.people.natch)?.amount).toBeCloseTo(50);
    expect(result.individualFixedTotal).toBeCloseTo(250);
    // 4500 - 1000 (fixa) - 1125 (diário) - 250 (individuais) - 1800 (transferência) = 325
    expect(result.surplus).toBeCloseTo(2125);
    expect(result.availableForGoals).toBeCloseTo(325);
  });

  it("does not produce NaN or division by zero without income", () => {
    const noIncome = withTemplates([specTemplate], { personIncomes: [] });
    const result = calculateMonthlyPlan(noIncome, exampleAnnualPlan, january);

    expect(result.totalIncome).toBe(0);
    expect(result.transfers.every((transfer) => transfer.minimumAmount === 900)).toBe(true);
    expect(Number.isFinite(result.totalTransferRequirement)).toBe(true);
    expect(Number.isFinite(result.surplusAfterTransfers)).toBe(true);
  });
});
