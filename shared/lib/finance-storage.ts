import type { FinanceState, PersonIncome } from "@/features/monthly-plan/domain/types";
import { entitiesClient } from "@/shared/lib/entities-client";

// A fonte de dados é só a base de dados: pessoas, rendimentos, contas, categorias,
// templates de categorias e objetivos vêm das APIs. Meses e planos anuais locais
// ficam vazios (os meses reais vivem nas APIs /api/months e /api/goal-plan).
// Este módulo nunca lê nem escreve window.localStorage.
export async function loadFinanceState(): Promise<FinanceState> {
  const [categoryTemplates, people, accounts, categories, dbGoals] = await Promise.all([
    entitiesClient.getCategoryTemplates(),
    entitiesClient.getPeople(),
    entitiesClient.getAccounts(),
    entitiesClient.getCategories(),
    entitiesClient.getGoals(),
  ]);
  const incomesByPerson = await Promise.all(people.map((person) => entitiesClient.getPersonIncomes(person.id)));
  const personIncomes: PersonIncome[] = incomesByPerson.flat();

  return {
    configuration: {
      people,
      personIncomes,
      accounts,
      categories,
      categoryTemplates,
      goals: dbGoals.map((goal) => ({ id: goal.id, name: goal.name, target: 0, period: "Anual", priority: "Nice to have" as const, notes: "" })),
    },
    annualPlans: [],
    months: [],
  };
}

export function showFinanceStorageError(error: unknown) {
  console.error("Finance data could not be loaded or saved.", error);
  window.alert("Não foi possível carregar os dados. Verifica a ligação à base de dados e tenta novamente.");
}
