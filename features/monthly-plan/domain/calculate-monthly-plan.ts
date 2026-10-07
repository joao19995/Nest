import type { FinancialConfiguration, MonthlyCalculation, MonthlyPlan } from "./types";

function applicableIncome(configuration: FinancialConfiguration, personId: string, month: string) {
  const income = configuration.incomes.find((item) => item.personId === personId);
  if (!income) return 0;

  return income.periods
    .filter((period) => period.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.amount ?? 0;
}

export function calculateMonthlyPlan(configuration: FinancialConfiguration, month: MonthlyPlan): MonthlyCalculation {
  const incomeByPerson = configuration.people.map((person) => ({
    personId: person.id,
    amount: applicableIncome(configuration, person.id, month.month),
  }));
  const totalIncome = incomeByPerson.reduce((total, income) => total + income.amount, 0);
  const plannedExpenses = month.expenses.reduce((total, expense) => total + expense.planned, 0);
  const actualExpenses = month.expenses.reduce((total, expense) => total + expense.actual, 0);
  const dailySpending = totalIncome * configuration.dailySpendingPercentage / 100;
  const surplus = totalIncome - configuration.fixedExpenses - dailySpending;
  const emergencyFund = configuration.fixedExpenses * 1.1 * 6;
  const jointAccount = configuration.accounts.find((account) => account.name === "Conjunta");
  const jointExpenses = month.expenses
    .filter((expense) => expense.accountId === jointAccount?.id)
    .reduce((total, expense) => total + expense.actual, 0);
  const transfers = configuration.people.map((person) => ({
    personId: person.id,
    amount: Math.max(configuration.contributionRules.find((rule) => rule.personId === person.id)?.minimumAmount ?? 0, jointExpenses),
    accountId: jointAccount?.id ?? "",
  }));

  return {
    incomeByPerson,
    totalIncome,
    plannedExpenses,
    actualExpenses,
    dailySpending,
    surplus,
    emergencyFund,
    transfers,
    availableForGoals: Math.max(surplus, 0),
  };
}
