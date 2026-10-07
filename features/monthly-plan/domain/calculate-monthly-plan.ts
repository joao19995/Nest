import type { FinancialConfiguration, GoalAllocation, MonthlyCalculation, MonthlyPlan } from "./types";

function applicableIncome(configuration: FinancialConfiguration, personId: string, month: string) {
  const income = configuration.incomes.find((item) => item.personId === personId);
  if (!income) return 0;

  return income.periods
    .filter((period) => period.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.amount ?? 0;
}

function quarterForMonth(month: string) {
  return `T${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
}

function calculateGoalAllocations(configuration: FinancialConfiguration, month: string, available: number, previousAllocations: GoalAllocation[]): GoalAllocation[] {
  if (available <= 0) return [];
  const quarter = quarterForMonth(month);
  const eligibleGoals = configuration.goals
    .filter((goal) => goal.period === "Anual" || goal.period === quarter)
    .sort((a, b) => {
      if (a.period === quarter && b.period !== quarter) return -1;
      if (a.period !== quarter && b.period === quarter) return 1;
      if (a.priority === "Grande" && b.priority !== "Grande") return -1;
      if (a.priority !== "Grande" && b.priority === "Grande") return 1;
      return 0;
    })
    .slice(0, configuration.goalAllocation.maxGoalsPerMonth);

  return eligibleGoals.slice(0, 1).flatMap((goal) => {
    const alreadyAllocated = previousAllocations.filter((allocation) => allocation.goalId === goal.id).reduce((sum, allocation) => sum + allocation.amount, 0);
    const remaining = Math.max(goal.target - alreadyAllocated, 0);
    return remaining > 0 ? [{ goalId: goal.id, amount: Math.min(available, remaining) }] : [];
  });
}

export function calculateMonthlyPlan(configuration: FinancialConfiguration, month: MonthlyPlan, previousAllocations: GoalAllocation[] = []): MonthlyCalculation {
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
  const minimumTransfers = configuration.people.map((person) => ({
    personId: person.id,
    minimumAmount: configuration.contributionRules.find((rule) => rule.personId === person.id)?.minimumAmount ?? 0,
    accountId: jointAccount?.id ?? "",
  }));
  const totalMinimum = minimumTransfers.reduce((total, transfer) => total + transfer.minimumAmount, 0);
  const totalTransferRequirement = Math.max(jointExpenses, totalMinimum);
  const transfers = minimumTransfers.map((transfer) => ({
    ...transfer,
    amount: totalTransferRequirement === totalMinimum ? transfer.minimumAmount : null,
    status: totalTransferRequirement === totalMinimum ? "calculated" as const : "pending-extra-allocation" as const,
  }));
  const surplusAfterTransfers = surplus - totalTransferRequirement;
  const availableForGoals = Math.max(surplusAfterTransfers, 0);
  const goalAllocations = calculateGoalAllocations(configuration, month.month, availableForGoals, previousAllocations);

  return {
    incomeByPerson,
    totalIncome,
    plannedExpenses,
    actualExpenses,
    fixedExpenses: configuration.fixedExpenses,
    dailySpending,
    surplus,
    emergencyFund,
    totalJointExpenses: jointExpenses,
    totalTransferRequirement,
    transfers,
    surplusAfterTransfers,
    availableForGoals,
    goalAllocations,
  };
}
