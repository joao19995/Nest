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
  annualSubsidies?: number;
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
  dailySpending: number;
  surplus: number;
  emergencyFund: number;
  transfers: { personId: string; amount: number; accountId: string }[];
  availableForGoals: number;
};

export type GoalAllocation = {
  goalId: string;
  amount: number;
};
