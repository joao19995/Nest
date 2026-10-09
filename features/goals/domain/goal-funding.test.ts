import { describe, expect, it } from "vitest";
import type { PersonIncome } from "@/features/monthly-plan/domain/types";
import { calculateAvailableForGoals } from "./calculate-available-for-goals";
import { computeMonthFunding, computeYearFunding, type FundingInput, type MonthFunding } from "./goal-funding";

// Referência: cálculo mês a mês tal como era feito antes (um mês de cada vez,
// com procura direta do plano e do template aplicável).
function monthByMonth(month: string, input: FundingInput): MonthFunding {
  const individualFixedTotal = input.people.reduce((total, person) => total + (person.individualFixedAmount ?? 0), 0);
  const plan = input.plans.find((item) => item.month === month);
  const applicable = input.templates
    .filter((item) => item.validFrom <= month)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  let contributionRequired = 0;
  if (plan && plan.entries.length) {
    contributionRequired = plan.entries.reduce((total, entry) => total + entry.planned, 0);
  } else if (applicable) {
    contributionRequired = applicable.entries.filter((entry) => entry.active).reduce((total, entry) => total + entry.expectedAmount, 0);
  }
  const result = calculateAvailableForGoals({
    month,
    incomes: input.incomes,
    people: input.people.map((person) => ({ personId: person.id, dailySpendingPercentage: person.dailySpendingPercentage })),
    contributionRequired,
    individualFixedTotal,
  });
  return {
    month,
    incomeNormal: result.incomeNormal,
    bonus: result.bonus,
    dailyAllowance: result.dailyAllowance,
    contributionRequired: result.contributionRequired,
    individualFixedTotal: result.individualFixedTotal,
    available: Math.round(result.available * 100) / 100,
  };
}

const incomes: PersonIncome[] = [
  { id: "1", personId: "joao", amount: 2500, validFrom: "2026-01-01" },
  { id: "2", personId: "joao", amount: 2680, validFrom: "2026-05-01" },
  { id: "3", personId: "natch", amount: 2000, validFrom: "2026-01-01" },
  { id: "4", personId: "ana", amount: 1500, validFrom: "2026-03-15" },
];

const scenarios: { name: string; input: FundingInput }[] = [
  {
    name: "planos com linhas, meses sem plano e template com entrada inativa",
    input: {
      people: [
        { id: "joao", dailySpendingPercentage: 25, individualFixedAmount: 150.5 },
        { id: "natch", dailySpendingPercentage: 20, individualFixedAmount: 0 },
        { id: "ana", dailySpendingPercentage: 10, individualFixedAmount: 75.25 },
      ],
      incomes,
      plans: [
        { month: "2026-01", entries: [{ planned: 1000 }, { planned: 800.1 }] },
        { month: "2026-02", entries: [{ planned: 1000 }] },
        { month: "2026-04", entries: [{ planned: 1234.56 }] },
      ],
      templates: [
        { validFrom: "2026-01", entries: [{ expectedAmount: 1800.1, active: true }, { expectedAmount: 99, active: false }] },
        { validFrom: "2026-07", entries: [{ expectedAmount: 2100, active: true }] },
      ],
    },
  },
  {
    name: "plano sem linhas cai para o template aplicável",
    input: {
      people: [{ id: "joao", dailySpendingPercentage: 25, individualFixedAmount: 0 }, { id: "natch", dailySpendingPercentage: 25, individualFixedAmount: 0 }],
      incomes,
      plans: [{ month: "2026-03", entries: [] }],
      templates: [{ validFrom: "2026-01", entries: [{ expectedAmount: 500.33, active: true }] }],
    },
  },
  {
    name: "sem template nem plano: contribuição zero",
    input: {
      people: [{ id: "joao", dailySpendingPercentage: 25, individualFixedAmount: 0 }],
      incomes,
      plans: [],
      templates: [],
    },
  },
  {
    name: "sem pessoas nem rendimentos",
    input: { people: [], incomes: [], plans: [], templates: [] },
  },
];

describe("funding do ano calculado de uma vez = cálculo mês a mês", () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const year = computeYearFunding(2026, scenario.input);
      const reference = Array.from({ length: 12 }, (_, index) => monthByMonth(`2026-${String(index + 1).padStart(2, "0")}`, scenario.input));
      expect(year.months).toEqual(reference);
      expect(year.annualTotal).toBe(Math.round(reference.reduce((total, item) => total + item.available, 0) * 100) / 100);
    });
  }

  it("computeMonthFunding devolve o mesmo que a linha correspondente do ano", () => {
    const input = scenarios[0].input;
    const year = computeYearFunding(2026, input);
    expect(computeMonthFunding("2026-05", input)).toEqual(year.months[4]);
  });
});

describe("regras do disponível", () => {
  it("bónus em junho e dezembro e a contribuição vem do plano quando existe", () => {
    const input = scenarios[0].input;
    const june = computeMonthFunding("2026-06", input);
    expect(june.bonus).toBe(2680 + 2000 + 1500);
    const february = computeMonthFunding("2026-02", input);
    expect(february.contributionRequired).toBe(1000);
    expect(february.individualFixedTotal).toBeCloseTo(225.75, 10);
  });
});
