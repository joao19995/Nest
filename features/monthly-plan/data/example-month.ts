import type { MonthlyPlan } from "../domain/types";

export const exampleMonth: MonthlyPlan = {
  month: "Outubro 2026",
  people: [
    { name: "João", income: 2680, incomeHistory: [{ amount: 2500, validFrom: "Janeiro 2026" }, { amount: 2680, validFrom: "Maio 2026" }], annualSubsidies: 5360, fixedExpenses: 950, dailyAmount: 670, budget: 1060 },
    { name: "Natch", income: 2000, incomeHistory: [{ amount: 2000, validFrom: "Janeiro 2026" }], annualSubsidies: 4000, fixedExpenses: 700, dailyAmount: 500, budget: 800 },
  ],
  expenses: [
    { category: "Casa", planned: 500, actual: 471.94 },
    { category: "Carro", planned: 100, actual: 130 },
    { category: "Cão", planned: 80, actual: 80 },
    { category: "Extras", planned: 180, actual: 210 },
  ],
  transfers: [
    { person: "João", amount: 1060, account: "Conjunta" },
    { person: "Natch", amount: 800, account: "Conjunta" },
  ],
  goals: [
    { name: "Viagem ao Brasil", target: 4000, allocated: 500, color: "gold", period: "T4", priority: "Grande", notes: "Família e memórias" },
    { name: "Bustelo", target: 20000, allocated: 300, color: "violet", period: "Anual", priority: "Grande", notes: "Construção do futuro lar" },
    { name: "Carro elétrico", target: 5530, allocated: 0, color: "blue", period: "Anual", priority: "Grande", notes: "O Opel está a dar o berro" },
    { name: "Viagem à Madeira", target: 800, allocated: 0, color: "green", period: "T1", priority: "Grande", notes: "Família e memórias" },
    { name: "Acampar na Freita", target: 50, allocated: 0, color: "orange", period: "T3", priority: "Grande", notes: "Conexão com a natureza" },
    { name: "SPA Hotel", target: 300, allocated: 0, color: "purple", period: "T4", priority: "Grande", notes: "Sair da rotina" },
    { name: "Freita Trekking", target: 50, allocated: 0, color: "blue", period: "T2", priority: "Nice to have", notes: "Bem-estar, desporto" },
    { name: "Piquenique romântico", target: 50, allocated: 0, color: "green", period: "T3", priority: "Nice to have", notes: "Momento especial a dois" },
    { name: "Momento a dois semanal", target: 0, allocated: 0, color: "orange", period: "Anual", priority: "Nice to have", notes: "Fortalecer a conexão" },
  ],
};
