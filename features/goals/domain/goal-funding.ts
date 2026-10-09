import type { PersonIncome } from "@/features/monthly-plan/domain/types";
import { calculateAvailableForGoals } from "./calculate-available-for-goals";

export type MonthFunding = {
  month: string; // YYYY-MM
  incomeNormal: number;
  bonus: number;
  dailyAllowance: number;
  contributionRequired: number;
  individualFixedTotal: number;
  available: number;
};

export type YearFunding = {
  year: number;
  months: MonthFunding[];
  annualTotal: number;
};

// Dados já carregados da base de dados (um conjunto por pedido, não por mês).
export type FundingInput = {
  people: { id: string; dailySpendingPercentage: number; individualFixedAmount: number }[];
  incomes: PersonIncome[];
  plans: { month: string; entries: { planned: number }[] }[];
  templates: { validFrom: string; entries: { expectedAmount: number; active: boolean }[] }[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Contribuição do mês: total planeado do plano (valores predefinidos), ou total
// do template aplicável quando o mês ainda não existe ou não tem linhas.
// O actual nunca entra aqui.
export function contributionForMonth(month: string, input: FundingInput): number {
  const plan = input.plans.find((item) => item.month === month);
  if (plan && plan.entries.length) {
    return plan.entries.reduce((total, entry) => total + entry.planned, 0);
  }
  const template = input.templates
    .filter((item) => item.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1);
  if (!template) return 0;
  return template.entries.filter((entry) => entry.active).reduce((total, entry) => total + entry.expectedAmount, 0);
}

export function computeMonthFunding(month: string, input: FundingInput): MonthFunding {
  const individualFixedTotal = input.people.reduce((total, person) => total + (person.individualFixedAmount ?? 0), 0);
  const result = calculateAvailableForGoals({
    month,
    incomes: input.incomes,
    people: input.people.map((person) => ({ personId: person.id, dailySpendingPercentage: person.dailySpendingPercentage })),
    contributionRequired: contributionForMonth(month, input),
    individualFixedTotal,
  });
  return {
    month,
    incomeNormal: result.incomeNormal,
    bonus: result.bonus,
    dailyAllowance: result.dailyAllowance,
    contributionRequired: result.contributionRequired,
    individualFixedTotal: result.individualFixedTotal,
    available: round2(result.available),
  };
}

export function computeYearFunding(year: number, input: FundingInput): YearFunding {
  const months = Array.from({ length: 12 }, (_, index) => computeMonthFunding(`${year}-${String(index + 1).padStart(2, "0")}`, input));
  return { year, months, annualTotal: round2(months.reduce((total, item) => total + item.available, 0)) };
}
