import type { PersonIncome } from "@/features/monthly-plan/domain/types";

// Meses de bónus fixos (subsídios de junho e dezembro).
const BONUS_MONTHS = [6, 12];

export type PersonDailyRate = {
  personId: string;
  dailySpendingPercentage: number;
};

// Resto do ordenado planeado para objetivos:
//   max(0, incomeNormal - contributionRequired - dailyAllowance) + bonus
// - incomeNormal: soma dos rendimentos aplicáveis ao mês (sem bónus).
// - dailyAllowance: percentagem diária aplicada só ao rendimento normal.
// - contributionRequired: total do template aplicável ao mês (entradas
//   ativas). Vem sempre do template, nunca do plano mensal.
// - bonus: incomeNormal nos meses 06/12, senão 0.
export function calculateAvailableForGoals(input: {
  month: string; // YYYY-MM
  incomes: PersonIncome[];
  people: PersonDailyRate[];
  contributionRequired: number;
}): { incomeNormal: number; bonus: number; dailyAllowance: number; contributionRequired: number; available: number } {
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
  const available = Math.max(0, incomeNormal - contributionRequired - dailyAllowance) + bonus;
  return { incomeNormal, bonus, dailyAllowance, contributionRequired, available };
}
