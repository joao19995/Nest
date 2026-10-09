import { getPostgres } from "@/shared/lib/postgres";
import { personRepository } from "@/shared/repositories/person-repository";
import { categoryTemplateRepository } from "@/shared/repositories/category-template-repository";
import { monthlyPlanRepository } from "@/shared/repositories/monthly-plan-repository";
import { calculateAvailableForGoals } from "@/features/goals/domain/calculate-available-for-goals";
import type { PersonIncome } from "@/features/monthly-plan/domain/types";

export type MonthFunding = {
  month: string; // YYYY-MM
  incomeNormal: number;
  bonus: number;
  dailyAllowance: number;
  contributionRequired: number;
  individualFixedTotal: number;
  available: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

async function loadIncomes(): Promise<PersonIncome[]> {
  const sql = getPostgres();
  const rows = await sql<{ id: string; person_id: string; amount: number | string; valid_from: string }[]>`
    SELECT id, person_id, amount, to_char(valid_from, 'YYYY-MM-DD') AS valid_from FROM person_income
  `;
  return rows.map((row) => ({ id: row.id, personId: row.person_id, amount: Number(row.amount), validFrom: row.valid_from }));
}

// Contribuição do mês: total planeado do monthly_plan (valores predefinidos),
// ou total do template aplicável quando o mês ainda não existe.
// O actual do mês é independente: nunca altera o disponível para objetivos.
async function contributionFor(month: string): Promise<number> {
  const plan = await monthlyPlanRepository.findByMonth(month);
  if (plan && plan.entries.length) {
    return plan.entries.reduce((total, entry) => total + entry.planned, 0);
  }
  const template = await categoryTemplateRepository.findApplicable(month);
  if (!template) return 0;
  return template.entries.filter((entry) => entry.active).reduce((total, entry) => total + entry.expectedAmount, 0);
}

export async function getMonthFunding(month: string): Promise<MonthFunding> {
  const people = await personRepository.findAll();
  const incomes = await loadIncomes();
  const individualFixedTotal = people.reduce((total, person) => total + (person.individualFixedAmount ?? 0), 0);
  const result = calculateAvailableForGoals({
    month,
    incomes,
    people: people.map((person) => ({ personId: person.id, dailySpendingPercentage: person.dailySpendingPercentage })),
    contributionRequired: await contributionFor(month),
    individualFixedTotal,
  });
  return { month, incomeNormal: result.incomeNormal, bonus: result.bonus, dailyAllowance: result.dailyAllowance, contributionRequired: result.contributionRequired, individualFixedTotal: result.individualFixedTotal, available: round2(result.available) };
}

export type YearFunding = {
  year: number;
  months: MonthFunding[];
  annualTotal: number;
};

export async function getYearFunding(year: number): Promise<YearFunding> {
  const months: MonthFunding[] = [];
  for (let index = 1; index <= 12; index += 1) {
    const month = `${year}-${String(index).padStart(2, "0")}`;
    months.push(await getMonthFunding(month));
  }
  return { year, months, annualTotal: round2(months.reduce((total, item) => total + item.available, 0)) };
}
