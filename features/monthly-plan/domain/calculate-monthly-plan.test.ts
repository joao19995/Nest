import { describe, expect, it } from "vitest";
import { exampleConfiguration, exampleMonth } from "../data/example-month";
import { calculateMonthlyPlan } from "./calculate-monthly-plan";

describe("calculateMonthlyPlan", () => {
  it("uses the income period applicable to the selected month", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, { ...exampleMonth, month: "2026-01" });

    expect(result.incomeByPerson).toEqual([
      { personId: "joao", amount: 2500 },
      { personId: "natch", amount: 2000 },
    ]);
    expect(result.dailySpending).toBe(1125);
    expect(result.surplus).toBe(2375);
  });

  it("calculates the global emergency fund", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleMonth);

    expect(result.emergencyFund).toBe(6600);
    expect(result.dailySpending).toBe(1170);
    expect(result.surplusAfterTransfers).toBe(710);
    expect(result.goalAllocations).toEqual([{ goalId: "brazil", amount: 710 }]);

    const nextMonth = { ...exampleMonth, month: "2026-11" };
    const nextResult = calculateMonthlyPlan(exampleConfiguration, nextMonth, result.goalAllocations);
    expect(nextResult.goalAllocations).toEqual([{ goalId: "brazil", amount: 710 }]);
  });

  it("calculates transfers from the minimum and joint actual expenses", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleMonth);
    expect(result.transfers).toEqual([
      { personId: "joao", minimumAmount: 1000, amount: 1000, accountId: "joint", status: "calculated" },
      { personId: "natch", minimumAmount: 800, amount: 800, accountId: "joint", status: "calculated" },
    ]);

    const highJointExpenses = { ...exampleMonth, expenses: [{ categoryId: "house", accountId: "joint", planned: 1300, actual: 1300 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, highJointExpenses).totalJointExpenses).toBe(1300);
    expect(calculateMonthlyPlan(exampleConfiguration, highJointExpenses).totalTransferRequirement).toBe(1800);
    expect(calculateMonthlyPlan(exampleConfiguration, highJointExpenses).transfers.every((transfer) => transfer.status === "calculated")).toBe(true);

    const expensesAboveMinimum = { ...exampleMonth, expenses: [{ categoryId: "house", accountId: "joint", planned: 2000, actual: 2000 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, expensesAboveMinimum).totalTransferRequirement).toBe(2000);
    expect(calculateMonthlyPlan(exampleConfiguration, expensesAboveMinimum).transfers.every((transfer) => transfer.status === "pending-extra-allocation")).toBe(true);
  });
});
