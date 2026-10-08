import type { MonthlyPlanEntryView, PersonIncome } from "./types";

// Margem de 10% sobre o total planeado do mês.
export const CONTRIBUTION_MARGIN = 1.1;

// Rendimento aplicável a um mês: o income mais recente com validFrom <= primeiro dia do mês.
export function applicableIncome(incomes: PersonIncome[], personId: string, month: string): number {
  return incomes
    .filter((income) => income.personId === personId && income.validFrom.slice(0, 7) <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.amount ?? 0;
}

export function totalPlanned(entries: Pick<MonthlyPlanEntryView, "planned">[]): number {
  return entries.reduce((total, entry) => total + entry.planned, 0);
}

export function totalActual(entries: Pick<MonthlyPlanEntryView, "actual">[]): number {
  return entries.reduce((total, entry) => total + entry.actual, 0);
}

// Só despesas pagas por uma conta pessoal (ownerPersonId) reduzem a transferência dessa pessoa, e só o actual conta.
export function personalActualFor(entries: MonthlyPlanEntryView[], personId: string): number {
  return entries
    .filter((entry) => entry.accountOwnerPersonId === personId)
    .reduce((total, entry) => total + entry.actual, 0);
}

export type PersonContribution = {
  personId: string;
  income: number;
  contribution: number;
  personalActual: number;
  transferNeeded: number;
};

export type MonthContributions =
  | { status: "ok"; contributionRequired: number; people: PersonContribution[] }
  | { status: "no-income"; message: string };

// Contribuição = total planeado × 1,10, dividida pelo rendimento de cada pessoa.
// Transferência = max(0, contribuição − actual pago pela conta pessoal).
export function calculateMonthContributions(input: {
  month: string;
  entries: MonthlyPlanEntryView[];
  personIds: string[];
  incomes: PersonIncome[];
}): MonthContributions {
  const incomeByPerson = input.personIds.map((personId) => ({ personId, income: applicableIncome(input.incomes, personId, input.month) }));
  const totalIncome = incomeByPerson.reduce((total, item) => total + item.income, 0);
  if (totalIncome <= 0) {
    return { status: "no-income", message: "Não é possível calcular as contribuições porque não existem rendimentos configurados para este mês." };
  }

  const contributionRequired = totalPlanned(input.entries) * CONTRIBUTION_MARGIN;
  const people = incomeByPerson.map(({ personId, income }) => {
    const contribution = contributionRequired * income / totalIncome;
    const personalActual = personalActualFor(input.entries, personId);
    return { personId, income, contribution, personalActual, transferNeeded: Math.max(0, contribution - personalActual) };
  });
  return { status: "ok", contributionRequired, people };
}

// Template aplicável ao mês: o de validFrom mais recente que seja <= mês (null se não existir).
export function resolveApplicableTemplateId(templates: { id: string; validFrom: string }[], month: string): string | null {
  return templates
    .filter((template) => template.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.id ?? null;
}
