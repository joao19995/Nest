import { describe, expect, it } from "vitest";
import { calculateAvailableForGoals } from "./calculate-available-for-goals";

const people = [
  { personId: "joao", dailySpendingPercentage: 25 },
  { personId: "natch", dailySpendingPercentage: 25 },
];

const incomes = [
  { id: "i1", personId: "joao", amount: 2500, validFrom: "2026-01-01" },
  { id: "i2", personId: "natch", amount: 2000, validFrom: "2026-01-01" },
];

describe("calculateAvailableForGoals", () => {
  it("usa o resto do ordenado: normal - contribuições - diário", () => {
    // 4500 - 1870 - 1125 = 1505
    const result = calculateAvailableForGoals({ month: "2026-03", incomes, people, contributionRequired: 1870 });
    expect(result.incomeNormal).toBe(4500);
    expect(result.bonus).toBe(0);
    expect(result.dailyAllowance).toBe(1125);
    expect(result.available).toBeCloseTo(1505);
  });

  it("soma o bónus total nos meses 06 e 12", () => {
    const june = calculateAvailableForGoals({ month: "2026-06", incomes, people, contributionRequired: 1870 });
    expect(june.bonus).toBe(4500);
    expect(june.available).toBeCloseTo(1505 + 4500);

    const december = calculateAvailableForGoals({ month: "2026-12", incomes, people, contributionRequired: 1870 });
    expect(december.available).toBeCloseTo(1505 + 4500);
  });

  it("subtrai os gastos fixos individuais ao disponível", () => {
    // 4500 - 1870 - 250 - 1125 = 1255
    const result = calculateAvailableForGoals({ month: "2026-03", incomes, people, contributionRequired: 1870, individualFixedTotal: 250 });
    expect(result.individualFixedTotal).toBe(250);
    expect(result.available).toBeCloseTo(1255);
  });

  it("nunca devolve negativo e usa o income aplicável ao mês", () => {
    const tight = calculateAvailableForGoals({ month: "2026-03", incomes, people, contributionRequired: 5000 });
    expect(tight.available).toBe(4500 > 5000 + 1125 ? tight.available : 0);

    const withRaise = [...incomes, { id: "i3", personId: "joao", amount: 3000, validFrom: "2026-05-01" }];
    const before = calculateAvailableForGoals({ month: "2026-04", incomes: withRaise, people, contributionRequired: 1870 });
    const after = calculateAvailableForGoals({ month: "2026-05", incomes: withRaise, people, contributionRequired: 1870 });
    expect(before.incomeNormal).toBe(4500);
    expect(after.incomeNormal).toBe(5000);
  });
});
