import type { FinanceState } from "@/features/monthly-plan/domain/types";

// Estado inicial vazio: a fonte de dados é só a base de dados.
// Sem BD configurada ou sem linhas, o UI mostra estados vazios em vez de exemplos.
// (Os dados de exemplo para testes unitários vivem em features/monthly-plan/data/example-month.ts.)
export const initialFinanceState: FinanceState = {
  configuration: {
    people: [],
    personIncomes: [],
    accounts: [],
    categories: [],
    categoryTemplates: [],
    goals: [],
  },
  annualPlans: [],
  months: [],
};
