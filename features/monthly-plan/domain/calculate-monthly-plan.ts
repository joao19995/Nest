import type { MonthlyPlan, MonthlySummary } from "./types";

export function calculateMonthlySummary(plan: MonthlyPlan): MonthlySummary {
  const income = plan.people.reduce((total, person) => total + person.income, 0);
  const plannedExpenses = plan.expenses.reduce((total, expense) => total + expense.planned, 0);
  const actualExpenses = plan.expenses.reduce((total, expense) => total + expense.actual, 0);
  const fixedExpenses = plan.people.reduce((total, person) => total + person.fixedExpenses, 0);
  const dayToDay = plan.people.reduce((total, person) => total + person.dailyAmount, 0);
  const surplus = income - fixedExpenses - dayToDay;
  const emergencyFund = (fixedExpenses * 1.1) * 6;
  const emergencyFundByPerson = plan.people.map((person) => ({
    person: person.name,
    amount: (person.fixedExpenses * 1.1) * 6,
  }));
  const transfers = plan.transfers.reduce((total, transfer) => total + transfer.amount, 0);

  return { income, plannedExpenses, actualExpenses, surplus, emergencyFund, emergencyFundByPerson, transfers, dayToDay };
}
