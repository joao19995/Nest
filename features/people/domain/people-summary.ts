import { applicableIncome } from "@/features/monthly-plan/domain/month-planning";
import type { Category, CategoryTemplate, Person, PersonIncome } from "@/features/monthly-plan/domain/types";

// Cartões e colunas da página Pessoas, calculados a partir da configuração.
// Fórmulas verificadas contra os valores do cálculo anterior (ver people-summary.test.ts).
export type PeopleSummaryInput = {
  month: string; // YYYY-MM
  people: Person[];
  incomes: PersonIncome[];
  categories: Category[];
  templates: CategoryTemplate[];
};

export type PersonAmount = { personId: string; amount: number };

export type PeopleSummary = {
  incomeByPerson: PersonAmount[];
  totalIncome: number;
  // Gastos variáveis: percentagem diária de cada vencimento.
  dailySpending: number;
  // Gastos fixos do template aplicável (categorias FIXED ativas).
  fixedExpenses: number;
  // Total do template aplicável (todas as entradas ativas).
  templateExpectedTotal: number;
  // Parte igual de cada pessoa no total do template.
  minimumByPerson: PersonAmount[];
  // "Gastos fixos conjuntos": soma das partes mínimas. Sem gastos reais no mês, o total é a soma das partes.
  jointFixedTotal: number;
  individualFixedByPerson: PersonAmount[];
  individualFixedTotal: number;
  // Fundo de emergência: gastos fixos × meses × peso do vencimento de cada pessoa.
  emergencyFundByPerson: PersonAmount[];
  emergencyFund: number;
};

function applicableTemplate(templates: CategoryTemplate[], month: string) {
  return templates.filter((template) => template.validFrom <= month).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1);
}

export function computePeopleSummary(input: PeopleSummaryInput): PeopleSummary {
  const { month, people, incomes, categories, templates } = input;
  const incomeByPerson = people.map((person) => ({ personId: person.id, amount: applicableIncome(incomes, person.id, month) }));
  const totalIncome = incomeByPerson.reduce((total, income) => total + income.amount, 0);

  const dailySpending = incomeByPerson.reduce((total, income) => {
    const person = people.find((item) => item.id === income.personId);
    return total + income.amount * (person?.dailySpendingPercentage ?? 0) / 100;
  }, 0);

  const template = applicableTemplate(templates, month);
  const activeCategory = (categoryId: string) => categories.find((category) => category.id === categoryId);
  const fixedExpenses = (template?.entries ?? [])
    .filter((entry) => entry.active && activeCategory(entry.categoryId)?.active && activeCategory(entry.categoryId)?.type === "FIXED")
    .reduce((total, entry) => total + entry.expectedAmount, 0);
  const templateExpectedTotal = (template?.entries ?? []).filter((entry) => entry.active).reduce((total, entry) => total + entry.expectedAmount, 0);

  const equalShare = people.length > 0 ? 1 / people.length : 0;
  const minimumByPerson = people.map((person) => ({ personId: person.id, amount: templateExpectedTotal * equalShare }));
  const jointFixedTotal = Math.max(0, minimumByPerson.reduce((total, item) => total + item.amount, 0));

  const individualFixedByPerson = people.map((person) => ({ personId: person.id, amount: person.individualFixedAmount ?? 0 }));
  const individualFixedTotal = individualFixedByPerson.reduce((total, item) => total + item.amount, 0);

  const emergencyFundByPerson = incomeByPerson.map((income) => {
    const person = people.find((item) => item.id === income.personId);
    const share = totalIncome > 0 ? income.amount / totalIncome : 0;
    return { personId: income.personId, amount: fixedExpenses * (person?.emergencyFundMonths ?? 0) * share };
  });
  const emergencyFund = emergencyFundByPerson.reduce((total, item) => total + item.amount, 0);

  return {
    incomeByPerson,
    totalIncome,
    dailySpending,
    fixedExpenses,
    templateExpectedTotal,
    minimumByPerson,
    jointFixedTotal,
    individualFixedByPerson,
    individualFixedTotal,
    emergencyFundByPerson,
    emergencyFund,
  };
}
