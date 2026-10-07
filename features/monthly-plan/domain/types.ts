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
  bonusMonths: number[];
};

export type FinancialConfiguration = {
  people: Person[];
  incomes: Income[];
  dailySpendingPercentage: number;
  emergencyFundMonths: number;
  contributionRules: MonthlyContributionRule[];
  accounts: Account[];
  categories: Category[];
  categoryTemplates: CategoryTemplate[];
  goals: Goal[];
};

export type MonthlyContributionRule = {
  personId: string;
  minimumAmount: number;
};

export type Account = {
  id: string;
  name: string;
  ownerPersonId: string | null;
};

export type Category = {
  id: string;
  name: string;
  type: "FIXED" | "VARIABLE";
  active: boolean;
};

export type CategoryTemplate = {
  validFrom: string;
  entries: CategoryTemplateEntry[];
};

export type CategoryTemplateEntry = {
  categoryId: string;
  expectedAmount: number;
  active: boolean;
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

export type AnnualGoalPlan = {
  year: number;
  allocations: GoalMonthlyAllocation[];
};

export type GoalMonthlyAllocation = {
  month: string; // YYYY-MM
  goalId: string;
  amount: number;
};

export type FinanceState = {
  configuration: FinancialConfiguration;
  annualPlans: AnnualGoalPlan[];
  months: MonthlyPlan[];
};

export type MonthlyCalculation = {
  incomeByPerson: { personId: string; amount: number }[];
  totalIncome: number;
  bonusesByPerson: { personId: string; amount: number }[];
  totalBonus: number;
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
  goalAllocations: GoalMonthlyAllocation[];
  allocatedToGoals: number;
  unallocatedForGoals: number;
};

export type TransferCalculation = {
  personId: string;
  minimumAmount: number;
  amount: number;
  accountId: string;
  status: "calculated";
};
