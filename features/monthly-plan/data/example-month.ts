import type { FinancialConfiguration, MonthlyPlan } from "../domain/types";
import { entitySeedIds } from "../../../shared/lib/entity-seed-ids";

export const exampleConfiguration: FinancialConfiguration = {
  people: [
    { id: entitySeedIds.people.joao, name: "João" },
    { id: entitySeedIds.people.natch, name: "Natch" },
  ],
  incomes: [
    { personId: entitySeedIds.people.joao, periods: [{ amount: 2500, validFrom: "2026-01" }, { amount: 2680, validFrom: "2026-05" }], bonusMonths: [6, 12] },
    { personId: entitySeedIds.people.natch, periods: [{ amount: 2000, validFrom: "2026-01" }], bonusMonths: [6, 12] },
  ],
  dailySpendingPercentage: 25,
  emergencyFundMonths: 6,
  contributionRules: [
    { personId: entitySeedIds.people.joao, minimumAmount: 1000 },
    { personId: entitySeedIds.people.natch, minimumAmount: 800 },
  ],
  accounts: [
    { id: entitySeedIds.accounts.joao, name: "João", ownerPersonId: entitySeedIds.people.joao },
    { id: entitySeedIds.accounts.natch, name: "Natch", ownerPersonId: entitySeedIds.people.natch },
    { id: entitySeedIds.accounts.joint, name: "Conjunta", ownerPersonId: null },
  ],
  categories: [
    { id: entitySeedIds.categories.house, name: "Casa", type: "FIXED", active: true },
    { id: entitySeedIds.categories.car, name: "Carro", type: "VARIABLE", active: true },
    { id: entitySeedIds.categories.dog, name: "Cão", type: "VARIABLE", active: true },
    { id: entitySeedIds.categories.extras, name: "Extras", type: "VARIABLE", active: true },
  ],
  categoryTemplates: [{ validFrom: "2026-01", entries: [
    { categoryId: entitySeedIds.categories.house, accountId: entitySeedIds.accounts.joint, expectedAmount: 1000, active: true },
    { categoryId: entitySeedIds.categories.car, accountId: entitySeedIds.accounts.joint, expectedAmount: 100, active: true },
    { categoryId: entitySeedIds.categories.dog, accountId: entitySeedIds.accounts.joint, expectedAmount: 80, active: true },
    { categoryId: entitySeedIds.categories.extras, accountId: entitySeedIds.accounts.joao, expectedAmount: 180, active: true },
  ] }],
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
    { categoryId: entitySeedIds.categories.house, accountId: entitySeedIds.accounts.joint, planned: 1000, actual: 471.94 },
    { categoryId: entitySeedIds.categories.car, accountId: entitySeedIds.accounts.joint, planned: 100, actual: 130 },
    { categoryId: entitySeedIds.categories.dog, accountId: entitySeedIds.accounts.joint, planned: 80, actual: 80 },
    { categoryId: entitySeedIds.categories.extras, accountId: entitySeedIds.accounts.joao, planned: 180, actual: 210 },
  ],
};

export const exampleAnnualPlan = { year: 2026, allocations: [] };
