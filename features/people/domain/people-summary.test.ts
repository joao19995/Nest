import { describe, expect, it } from "vitest";
import type { Category, CategoryTemplate, Person, PersonIncome } from "@/features/monthly-plan/domain/types";
import { computePeopleSummary } from "./people-summary";

const JOAO = "joao";
const NATCH = "natch";
const people: Person[] = [
  { id: JOAO, name: "João", dailySpendingPercentage: 25, emergencyFundMonths: 6, individualFixedAmount: 0 },
  { id: NATCH, name: "Natch", dailySpendingPercentage: 25, emergencyFundMonths: 6, individualFixedAmount: 0 },
];
const incomes: PersonIncome[] = [
  { id: "1", personId: JOAO, amount: 2500, validFrom: "2026-01-01" },
  { id: "2", personId: JOAO, amount: 2680, validFrom: "2026-05-01" },
  { id: "3", personId: NATCH, amount: 2000, validFrom: "2026-01-01" },
];
const categories: Category[] = [
  { id: "casa", name: "Casa", type: "FIXED", active: true },
  { id: "carro", name: "Carro", type: "VARIABLE", active: true },
  { id: "cao", name: "Cão", type: "VARIABLE", active: true },
  { id: "extras", name: "Extras", type: "VARIABLE", active: true },
];
const templates: CategoryTemplate[] = [{
  id: "t1",
  validFrom: "2026-01",
  entries: [
    { categoryId: "casa", accountId: "conjunta", expectedAmount: 1000, active: true },
    { categoryId: "carro", accountId: "conjunta", expectedAmount: 100, active: true },
    { categoryId: "cao", accountId: "conjunta", expectedAmount: 80, active: true },
    { categoryId: "extras", accountId: "joao", expectedAmount: 180, active: true },
  ],
}];

describe("computePeopleSummary", () => {
  it("reproduz os valores atuais do mês de janeiro (rendimentos 2500 e 2000)", () => {
    const summary = computePeopleSummary({ month: "2026-01", people, incomes, categories, templates });
    expect(summary.totalIncome).toBe(4500);
    // Gastos variáveis: 25% de cada vencimento = 625 + 500.
    expect(summary.dailySpending).toBeCloseTo(1125, 10);
    // Fixos do template (só categorias FIXED ativas) e total do template.
    expect(summary.fixedExpenses).toBe(1000);
    expect(summary.templateExpectedTotal).toBe(1360);
    // Gastos fixos conjuntos: metade do total do template por pessoa.
    expect(summary.minimumByPerson.map((item) => item.amount)).toEqual([680, 680]);
    expect(summary.jointFixedTotal).toBeCloseTo(1360, 10);
    expect(summary.individualFixedTotal).toBe(0);
  });

  it("fundo de emergência = fixos × meses × peso do vencimento de cada pessoa", () => {
    const summary = computePeopleSummary({ month: "2026-01", people, incomes, categories, templates });
    // 1000 × 6 × 2500/4500 = 3333,33 ; 1000 × 6 × 2000/4500 = 2666,67
    expect(summary.emergencyFundByPerson[0].amount).toBeCloseTo(3333.33, 2);
    expect(summary.emergencyFundByPerson[1].amount).toBeCloseTo(2666.67, 2);
    expect(summary.emergencyFund).toBeCloseTo(6000, 6);
  });

  it("usa o vencimento válido no mês (alteração salarial em maio)", () => {
    const summary = computePeopleSummary({ month: "2026-05", people, incomes, categories, templates });
    expect(summary.incomeByPerson.find((item) => item.personId === JOAO)?.amount).toBe(2680);
    expect(summary.totalIncome).toBe(4680);
    expect(summary.dailySpending).toBeCloseTo(2680 * 0.25 + 2000 * 0.25, 10);
  });

  it("soma os gastos fixos individuais preenchidos por pessoa", () => {
    const withIndividual = people.map((person, index) => ({ ...person, individualFixedAmount: index === 0 ? 150.5 : 75.25 }));
    const summary = computePeopleSummary({ month: "2026-01", people: withIndividual, incomes, categories, templates });
    expect(summary.individualFixedByPerson.map((item) => item.amount)).toEqual([150.5, 75.25]);
    expect(summary.individualFixedTotal).toBeCloseTo(225.75, 10);
  });

  it("ignora entradas inativas e categorias inativas nos fixos", () => {
    const withInactive: CategoryTemplate[] = [{ ...templates[0], entries: [...templates[0].entries, { categoryId: "carro", accountId: "conjunta", expectedAmount: 500, active: false }] }];
    const summary = computePeopleSummary({ month: "2026-01", people, incomes, categories, templates: withInactive });
    expect(summary.templateExpectedTotal).toBe(1360);
    const inactiveFixed: Category[] = categories.map((category) => category.id === "carro" ? { ...category, type: "FIXED" as const, active: false } : category);
    expect(computePeopleSummary({ month: "2026-01", people, incomes, categories: inactiveFixed, templates: withInactive }).fixedExpenses).toBe(1000);
  });

  it("sem rendimentos não divide por zero", () => {
    const summary = computePeopleSummary({ month: "2026-01", people, incomes: [], categories, templates });
    expect(summary.totalIncome).toBe(0);
    expect(summary.dailySpending).toBe(0);
    expect(summary.emergencyFund).toBe(0);
    expect(summary.emergencyFundByPerson.every((item) => Number.isFinite(item.amount))).toBe(true);
  });

  it("sem template aplicável fica tudo a zero", () => {
    const summary = computePeopleSummary({ month: "2025-12", people, incomes, categories, templates });
    expect(summary.templateExpectedTotal).toBe(0);
    expect(summary.jointFixedTotal).toBe(0);
    expect(summary.emergencyFund).toBe(0);
  });
});
