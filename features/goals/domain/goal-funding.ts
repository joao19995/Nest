import type { PersonIncome } from "@/features/monthly-plan/domain/types";
import { calculateAvailableForGoals } from "./calculate-available-for-goals";

export type MonthFunding = {
  month: string; // YYYY-MM
  incomeNormal: number;
  bonus: number;
  dailyAllowance: number;
  contributionRequired: number;
  available: number;
};

export type YearFunding = {
  year: number;
  months: MonthFunding[];
  annualTotal: number;
};

// Dados já carregados da base de dados (um conjunto por pedido, não por mês).
export type FundingInput = {
  people: { id: string; dailySpendingPercentage: number }[];
  incomes: PersonIncome[];
  templates: { validFrom: string; entries: { expectedAmount: number; active: boolean }[] }[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Contribuição do mês: total do template aplicável (entradas ativas).
// Vem sempre do template associado ao mês, nunca do plano mensal (que é
// execução e pode divergir do template quando há novas versões).
// Sem template aplicável, a contribuição é 0.
export function contributionForMonth(month: string, input: FundingInput): number {
  const template = input.templates
    .filter((item) => item.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1);
  if (!template) return 0;
  return template.entries.filter((entry) => entry.active).reduce((total, entry) => total + entry.expectedAmount, 0);
}

export function computeMonthFunding(month: string, input: FundingInput): MonthFunding {
  const result = calculateAvailableForGoals({
    month,
    incomes: input.incomes,
    people: input.people.map((person) => ({ personId: person.id, dailySpendingPercentage: person.dailySpendingPercentage })),
    contributionRequired: contributionForMonth(month, input),
  });
  return {
    month,
    incomeNormal: result.incomeNormal,
    bonus: result.bonus,
    dailyAllowance: result.dailyAllowance,
    contributionRequired: result.contributionRequired,
    available: round2(result.available),
  };
}

export function computeYearFunding(year: number, input: FundingInput): YearFunding {
  const months = Array.from({ length: 12 }, (_, index) => computeMonthFunding(`${year}-${String(index + 1).padStart(2, "0")}`, input));
  return { year, months, annualTotal: round2(months.reduce((total, item) => total + item.available, 0)) };
}
