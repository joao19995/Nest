import type { FinancialConfiguration, MonthlyPlan } from "../domain/types";

export const exampleConfiguration: FinancialConfiguration = {
  people: [
    { id: "joao", name: "João" },
    { id: "natch", name: "Natch" },
  ],
  incomes: [
    { personId: "joao", periods: [{ amount: 2500, validFrom: "2026-01" }, { amount: 2680, validFrom: "2026-05" }], bonusMonths: [6, 12] },
    { personId: "natch", periods: [{ amount: 2000, validFrom: "2026-01" }], bonusMonths: [6, 12] },
  ],
  dailySpendingPercentage: 25,
  emergencyFundMonths: 6,
  contributionRules: [
    { personId: "joao", minimumAmount: 1000 },
    { personId: "natch", minimumAmount: 800 },
  ],
  accounts: [
    { id: "joao", name: "João" },
    { id: "natch", name: "Natch" },
    { id: "joint", name: "Conjunta" },
  ],
  categories: [
    { id: "house", name: "Casa", type: "global", accountId: "joint" },
    { id: "car", name: "Carro", type: "normal", accountId: "joint" },
    { id: "dog", name: "Cão", type: "normal", accountId: "joint" },
    { id: "extras", name: "Extras", type: "normal", accountId: "joao" },
  ],
  categoryTemplates: [{ validFrom: "2026-01", entries: [{ categoryId: "house", expectedAmount: 1000, active: true }, { categoryId: "car", expectedAmount: 100, active: true }, { categoryId: "dog", expectedAmount: 80, active: true }, { categoryId: "extras", expectedAmount: 180, active: true }] }],
  goals: [
    { id: "brazil", name: "Viagem ao Brasil", target: 4000, period: "T4", priority: "Grande", notes: "Família e memórias" },
    { id: "bustelo", name: "Bustelo", target: 20000, period: "Anual", priority: "Grande", notes: "Construção do futuro lar" },
    { id: "car-electric", name: "Carro elétrico", target: 5530, period: "Anual", priority: "Grande", notes: "O Opel está a dar o berro" },
    { id: "madeira", name: "Viagem à Madeira", target: 800, period: "T1", priority: "Grande", notes: "Família e memórias" },
    { id: "camping", name: "Acampar na Freita", target: 50, period: "T3", priority: "Grande", notes: "Conexão com a natureza" },
    { id: "spa", name: "SPA Hotel", target: 300, period: "T4", priority: "Grande", notes: "Sair da rotina" },
    { id: "trekking", name: "Freita Trekking", target: 50, period: "T2", priority: "Nice to have", notes: "Bem-estar, desporto" },
    { id: "picnic", name: "Piquenique romântico", target: 50, period: "T3", priority: "Nice to have", notes: "Momento especial a dois" },
    { id: "weekly", name: "Momento a dois semanal", target: 0, period: "Anual", priority: "Nice to have", notes: "Fortalecer a conexão" },
  ],
};

export const exampleMonth: MonthlyPlan = {
  month: "2026-10",
  expenses: [
    { categoryId: "house", accountId: "joint", planned: 1000, actual: 471.94 },
    { categoryId: "car", accountId: "joint", planned: 100, actual: 130 },
    { categoryId: "dog", accountId: "joint", planned: 80, actual: 80 },
    { categoryId: "extras", accountId: "joao", planned: 180, actual: 210 },
  ],
};

export const exampleAnnualPlan = { year: 2026, allocations: [] };
