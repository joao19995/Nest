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
  });

  it("calculates transfers from the minimum and joint actual expenses", () => {
    const result = calculateMonthlyPlan(exampleConfiguration, exampleMonth);
    expect(result.transfers).toEqual([
      { personId: "joao", amount: 1000, accountId: "joint" },
      { personId: "natch", amount: 800, accountId: "joint" },
    ]);

    const highJointExpenses = { ...exampleMonth, expenses: [{ categoryId: "house", accountId: "joint", planned: 1300, actual: 1300 }] };
    expect(calculateMonthlyPlan(exampleConfiguration, highJointExpenses).transfers.every((transfer) => transfer.amount === 1300)).toBe(true);
  });
});
