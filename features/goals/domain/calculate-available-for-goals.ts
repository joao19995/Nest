import type { PersonIncome } from "@/features/monthly-plan/domain/types";

// Meses de bónus fixos, tal como em calculate-monthly-plan.ts.
const BONUS_MONTHS = [6, 12];

export type PersonDailyRate = {
  personId: string;
  dailySpendingPercentage: number;
};

// Resto do ordenado planeado para objetivos:
//   max(0, incomeNormal - contributionRequired - individualFixedTotal - dailyAllowance) + bonus
// - incomeNormal: soma dos rendimentos aplicáveis ao mês (sem bónus).
// - dailyAllowance: percentagem diária aplicada só ao rendimento normal.
// - contributionRequired: total planeado do monthly_plan (valores predefinidos),
//   ou do template aplicável quando o mês ainda não existe. O actual do mês
//   nunca entra aqui: gastos a mais saem do budget individual, não dos goals.
// - individualFixedTotal: soma dos gastos fixos individuais preenchidos por pessoa.
// - bonus: incomeNormal nos meses 06/12, senão 0.
export function calculateAvailableForGoals(input: {
  month: string; // YYYY-MM
  incomes: PersonIncome[];
  people: PersonDailyRate[];
  contributionRequired: number;
  individualFixedTotal?: number;
}): { incomeNormal: number; bonus: number; dailyAllowance: number; contributionRequired: number; individualFixedTotal: number; available: number } {
  const monthNumber = Number(input.month.slice(5, 7));
  const incomeByPerson = input.people.map((person) => ({
    personId: person.personId,
    amount:
      input.incomes
        .filter((income) => income.personId === person.personId && income.validFrom.slice(0, 7) <= input.month)
        .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
        .at(-1)?.amount ?? 0,
  }));
  const incomeNormal = incomeByPerson.reduce((total, item) => total + item.amount, 0);
  const bonus = BONUS_MONTHS.includes(monthNumber) ? incomeNormal : 0;
  const dailyAllowance = incomeByPerson.reduce((total, item) => {
    const rate = input.people.find((person) => person.personId === item.personId)?.dailySpendingPercentage ?? 0;
    return total + (item.amount * rate) / 100;
  }, 0);
  const contributionRequired = Math.max(input.contributionRequired, 0);
  const individualFixedTotal = Math.max(input.individualFixedTotal ?? 0, 0);
  const available = Math.max(0, incomeNormal - contributionRequired - individualFixedTotal - dailyAllowance) + bonus;
  return { incomeNormal, bonus, dailyAllowance, contributionRequired, individualFixedTotal, available };
}
