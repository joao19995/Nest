import { describe, expect, it } from "vitest";
import { exampleAnnualPlan, exampleConfiguration, exampleMonth } from "../data/example-month";
import { calculateMonthlyPlan, suggestGoalAllocations } from "./calculate-monthly-plan";
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

    expect(result.emergencyFund).toBe(6600);
    expect(result.dailySpending).toBe(1170);
    expect(result.surplusAfterTransfers).toBe(710);
    expect(result.goalAllocations).toEqual([]);
    expect(result.availableForGoals).toBe(710);
    expect(result.unallocatedForGoals).toBe(710);

    const nextMonth = { ...exampleMonth, month: "2026-11" };
    const nextResult = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, nextMonth);
    expect(nextResult.goalAllocations).toEqual([]);
    expect(suggestGoalAllocations(exampleConfiguration, exampleMonth.month, result.availableForGoals)).toEqual([{ month: "2026-10", goalId: "brazil", amount: 710 }]);
  });

  it("calculates transfers from the minimum and joint actual expenses", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, exampleMonth);
    expect(result.transfers).toEqual([
      { personId: entitySeedIds.people.joao, minimumAmount: 1000, amount: 1000, accountId: entitySeedIds.accounts.joint, status: "calculated" },
      { personId: entitySeedIds.people.natch, minimumAmount: 800, amount: 800, accountId: entitySeedIds.accounts.joint, status: "calculated" },
    ]);

    const highJointExpenses = { ...exampleMonth, expenses: [{ categoryId: entitySeedIds.categories.house, accountId: entitySeedIds.accounts.joint, planned: 1300, actual: 1300 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, highJointExpenses).totalJointExpenses).toBe(1300);
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, highJointExpenses).totalTransferRequirement).toBe(1800);
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, highJointExpenses).transfers.every((transfer) => transfer.status === "calculated")).toBe(true);

    const expensesAboveMinimum = { ...exampleMonth, expenses: [{ categoryId: entitySeedIds.categories.house, accountId: entitySeedIds.accounts.joint, planned: 2000, actual: 2000 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, expensesAboveMinimum).totalTransferRequirement).toBe(2000);
    const proportionalTransfers = calculateMonthlyPlan(exampleConfiguration, exampleAnnualPlan, expensesAboveMinimum).transfers;
    expect(proportionalTransfers.every((transfer) => transfer.status === "calculated")).toBe(true);
    expect(proportionalTransfers.reduce((sum, transfer) => sum + transfer.amount, 0)).toBe(2000);
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
    expect(result.unallocatedForGoals).toBe(210);
  });
});
