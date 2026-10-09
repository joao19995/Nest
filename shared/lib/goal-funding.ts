import { getPostgres } from "@/shared/lib/postgres";
import { personRepository } from "@/shared/repositories/person-repository";
import { categoryTemplateRepository } from "@/shared/repositories/category-template-repository";
import { monthlyPlanRepository } from "@/shared/repositories/monthly-plan-repository";
import { computeMonthFunding, computeYearFunding, type FundingInput, type MonthFunding, type YearFunding } from "@/features/goals/domain/goal-funding";
import type { PersonIncome } from "@/features/monthly-plan/domain/types";

// Carregamento dos dados do disponível para objetivos. O cálculo está em
// features/goals/domain/goal-funding.ts. Cada pedido lê pessoas, rendimentos,
// planos e templates uma única vez, para qualquer número de meses.

async function loadIncomes(): Promise<PersonIncome[]> {
  const sql = getPostgres();
  const rows = await sql<{ id: string; person_id: string; amount: number | string; valid_from: string }[]>`
    SELECT id, person_id, amount, to_char(valid_from, 'YYYY-MM-DD') AS valid_from FROM person_income
  `;
  return rows.map((row) => ({ id: row.id, personId: row.person_id, amount: Number(row.amount), validFrom: row.valid_from }));
}

async function loadFundingInput(plans: FundingInput["plans"]): Promise<FundingInput> {
  const [people, incomes, templates] = await Promise.all([
    personRepository.findAll(),
    loadIncomes(),
    categoryTemplateRepository.findAll(),
  ]);
  return { people, incomes, plans, templates };
}

export type { MonthFunding, YearFunding };

export async function getMonthFunding(month: string): Promise<MonthFunding> {
  const plan = await monthlyPlanRepository.findByMonth(month);
  return computeMonthFunding(month, await loadFundingInput(plan ? [plan] : []));
}

export async function getYearFunding(year: number): Promise<YearFunding> {
  const plans = await monthlyPlanRepository.listByYear(year);
  return computeYearFunding(year, await loadFundingInput(plans));
}
