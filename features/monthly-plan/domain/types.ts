export type Person = {
  id: string;
  name: string;
};

export type IncomePeriod = {
  amount: number;
  validFrom: string; // YYYY-MM
};

export type Income = {
  personId: string;
  periods: IncomePeriod[];
};

export type FinancialConfiguration = {
  people: Person[];
  incomes: Income[];
  fixedExpenses: number;
  dailySpendingPercentage: number;
  contributionRules: MonthlyContributionRule[];
  accounts: Account[];
  categories: Category[];
  goals: Goal[];
  goalAllocation: GoalAllocationRules;
};

export type GoalAllocationRules = {
  maxGoalsPerMonth: number;
};

export type MonthlyContributionRule = {
  personId: string;
  minimumAmount: number;
};

export type Account = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Expense = {
  categoryId: string;
  accountId: string;
  planned: number;
  actual: number;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  period: string;
  priority: "Grande" | "Nice to have";
  notes: string;
};

export type MonthlyPlan = {
  month: string; // YYYY-MM
  expenses: Expense[];
};

export type FinanceState = {
  configuration: FinancialConfiguration;
  months: MonthlyPlan[];
};

export type MonthlyCalculation = {
  incomeByPerson: { personId: string; amount: number }[];
  totalIncome: number;
  plannedExpenses: number;
  actualExpenses: number;
  fixedExpenses: number;
  dailySpending: number;
  surplus: number;
  emergencyFund: number;
  totalJointExpenses: number;
  totalTransferRequirement: number;
  transfers: TransferCalculation[];
  surplusAfterTransfers: number;
  availableForGoals: number;
  goalAllocations: GoalAllocation[];
};

export type TransferCalculation = {
  personId: string;
  minimumAmount: number;
  amount: number | null;
  accountId: string;
  status: "calculated" | "pending-extra-allocation";
};

export type GoalAllocation = {
  goalId: string;
  amount: number;
};
