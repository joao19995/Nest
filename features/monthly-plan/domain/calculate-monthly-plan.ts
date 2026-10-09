import type { AnnualGoalPlan, FinancialConfiguration, GoalMonthlyAllocation, MonthlyCalculation, MonthlyPlan } from "./types";

const FIXED_BONUS_MONTHS = [6, 12];

function applicableIncome(configuration: FinancialConfiguration, personId: string, month: string) {
  return configuration.personIncomes
    .filter((income) => income.personId === personId && income.validFrom.slice(0, 7) <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.amount ?? 0;
}

function quarterForMonth(month: string) {
  return `T${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
}

function applicableCategoryTemplate(configuration: FinancialConfiguration, month: string) {
  return configuration.categoryTemplates.filter((template) => template.validFrom <= month).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1);
}

function eligibleGoals(configuration: FinancialConfiguration, month: string) {
  const quarter = quarterForMonth(month);
  return configuration.goals.filter((goal) => goal.period === "Anual" || goal.period === quarter).sort((a, b) => {
    if (a.period === quarter && b.period !== quarter) return -1;
    if (a.period !== quarter && b.period === quarter) return 1;
    if (a.priority === "Grande" && b.priority !== "Grande") return -1;
    if (a.priority !== "Grande" && b.priority === "Grande") return 1;
    return 0;
  });
}

export function suggestGoalAllocations(configuration: FinancialConfiguration, month: string, available: number): GoalMonthlyAllocation[] {
  let remaining = Math.max(available, 0);
  return eligibleGoals(configuration, month).flatMap((goal) => {
    const amount = Math.min(remaining, goal.target);
    remaining -= amount;
    return amount > 0 ? [{ month, goalId: goal.id, amount }] : [];
  });
}

export function calculateMonthlyPlan(configuration: FinancialConfiguration, annualPlan: AnnualGoalPlan, month: MonthlyPlan): MonthlyCalculation {
  const incomeByPerson = configuration.people.map((person) => ({ personId: person.id, amount: applicableIncome(configuration, person.id, month.month) }));
  const totalIncome = incomeByPerson.reduce((total, income) => total + income.amount, 0);
  const monthNumber = Number(month.month.slice(5, 7));
  const bonusesByPerson = configuration.people.map((person) => ({ personId: person.id, amount: FIXED_BONUS_MONTHS.includes(monthNumber) ? applicableIncome(configuration, person.id, month.month) : 0 }));
  const totalBonus = bonusesByPerson.reduce((total, bonus) => total + bonus.amount, 0);
  const plannedExpenses = month.expenses.reduce((total, expense) => total + expense.planned, 0);
  const actualExpenses = month.expenses.reduce((total, expense) => total + expense.actual, 0);
  const template = applicableCategoryTemplate(configuration, month.month);
  const fixedExpenses = month.expenses.length
    ? month.expenses.filter((expense) => configuration.categories.find((category) => category.id === expense.categoryId)?.type === "FIXED").reduce((total, expense) => total + expense.planned, 0)
    : (template?.entries ?? []).filter((entry) => entry.active && configuration.categories.find((category) => category.id === entry.categoryId)?.active && configuration.categories.find((category) => category.id === entry.categoryId)?.type === "FIXED").reduce((total, entry) => total + entry.expectedAmount, 0);
  const templateExpectedTotal = (template?.entries ?? []).filter((entry) => entry.active).reduce((total, entry) => total + entry.expectedAmount, 0);
  const contributionRequired = templateExpectedTotal;
  const dailySpending = incomeByPerson.reduce((total, income) => {
    const person = configuration.people.find((item) => item.id === income.personId);
    return total + income.amount * (person?.dailySpendingPercentage ?? 0) / 100;
  }, 0);
  // Gastos fixos individuais: valor preenchido por pessoa (campo editável), não derivado do template.
  // Saem do excedente como qualquer outra despesa fixa, reduzindo o disponível para objetivos.
  const individualFixedByPerson = configuration.people.map((person) => ({
    personId: person.id,
    amount: person.individualFixedAmount ?? 0,
  }));
  const individualFixedTotal = individualFixedByPerson.reduce((total, item) => total + item.amount, 0);
  const surplus = totalIncome - fixedExpenses - dailySpending - individualFixedTotal;
  const emergencyFund = incomeByPerson.reduce((total, income) => {
    const person = configuration.people.find((item) => item.id === income.personId);
    const share = totalIncome > 0 ? income.amount / totalIncome : 0;
    return total + fixedExpenses * (person?.emergencyFundMonths ?? 0) * share;
  }, 0);
  const jointAccount = configuration.accounts.find((account) => account.name === "Conjunta");
  const jointExpenses = month.expenses.filter((expense) => expense.accountId === jointAccount?.id).reduce((total, expense) => total + expense.actual, 0);
  const equalShare = configuration.people.length > 0 ? 1 / configuration.people.length : 0;
  const minimumTransfers = configuration.people.map((person) => {
    return { personId: person.id, minimumAmount: contributionRequired * equalShare, accountId: jointAccount?.id ?? "" };
  });
  const totalMinimum = minimumTransfers.reduce((total, transfer) => total + transfer.minimumAmount, 0);
  const totalTransferRequirement = Math.max(jointExpenses, totalMinimum);
  const excess = Math.max(jointExpenses - totalMinimum, 0);
  const transfers = minimumTransfers.map((transfer) => {
    const incomeForTransfers = excess * equalShare;
    return { ...transfer, amount: transfer.minimumAmount + incomeForTransfers, status: "calculated" as const };
  });
  const surplusAfterTransfers = surplus - totalTransferRequirement;
  const availableForGoals = Math.max(surplusAfterTransfers, 0) + totalBonus;
  const goalAllocations = annualPlan.allocations.filter((allocation) => allocation.month === month.month);
  const allocatedToGoals = goalAllocations.reduce((total, allocation) => total + allocation.amount, 0);

  return { incomeByPerson, totalIncome, bonusesByPerson, totalBonus, plannedExpenses, actualExpenses, fixedExpenses, dailySpending, surplus, emergencyFund, totalJointExpenses: jointExpenses, templateExpectedTotal, contributionRequired, individualFixedByPerson, individualFixedTotal, totalTransferRequirement, transfers, surplusAfterTransfers, availableForGoals, goalAllocations, allocatedToGoals, unallocatedForGoals: Math.max(availableForGoals - allocatedToGoals, 0) };
}
