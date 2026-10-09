import type { FinanceState, PersonIncome } from "@/features/monthly-plan/domain/types";
import { entitiesClient } from "@/shared/lib/entities-client";

// A fonte de dados é só a base de dados: pessoas, rendimentos, contas, categorias,
// itens e templates de categorias vêm das APIs. Os meses vivem nas APIs
// /api/months e /api/goal-plan; os objetivos não fazem parte desta configuração.
// Este módulo nunca lê nem escreve window.localStorage.
export const emptyFinanceState: FinanceState = {
  configuration: { people: [], personIncomes: [], accounts: [], categories: [], items: [], categoryTemplates: [] },
};

export async function loadFinanceState(): Promise<FinanceState> {
  const [categoryTemplates, people, accounts, categories, items] = await Promise.all([
    entitiesClient.getCategoryTemplates(),
    entitiesClient.getPeople(),
    entitiesClient.getAccounts(),
    entitiesClient.getCategories(),
    entitiesClient.getItems(),
  ]);
  const incomesByPerson = await Promise.all(people.map((person) => entitiesClient.getPersonIncomes(person.id)));
  const personIncomes: PersonIncome[] = incomesByPerson.flat();

  return {
    configuration: { people, personIncomes, accounts, categories, items, categoryTemplates },
  };
}

export function showFinanceStorageError(error: unknown) {
  console.error("Finance data could not be loaded or saved.", error);
  window.alert("Não foi possível carregar os dados. Verifica a ligação à base de dados e tenta novamente.");
}
