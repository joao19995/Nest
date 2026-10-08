export type Person = {
  id: string;
  name: string;
  dailySpendingPercentage: number;
  emergencyFundMonths: number;
};

export type PersonIncome = {
  id: string;
  personId: string;
  amount: number;
  validFrom: string; // YYYY-MM-DD
};

export type FinancialConfiguration = {
  people: Person[];
  personIncomes: PersonIncome[];
  accounts: Account[];
  categories: Category[];
  categoryTemplates: CategoryTemplate[];
  goals: Goal[];
};

export type Account = {
  id: string;
  name: string;
  ownerPersonId: string | null;
  active: boolean;
};

export type Category = {
  id: string;
  name: string;
  type: "FIXED" | "VARIABLE";
  active: boolean;
};

export type CategoryTemplate = {
  id: string;
  validFrom: string; // YYYY-MM, primeiro mês em que o template entra em vigor
  entries: CategoryTemplateEntry[];
};

export type CategoryTemplateEntry = {
  categoryId: string;
  accountId: string;
  expectedAmount: number;
  active: boolean;
};

// Vista da API: inclui nome e estado de categoria/conta para mostrar entradas históricas (mesmo inativas).
export type CategoryTemplateEntryView = CategoryTemplateEntry & {
  categoryName: string;
  categoryType: Category["type"];
  categoryActive: boolean;
  accountName: string;
  accountActive: boolean;
};

export type CategoryTemplateView = Omit<CategoryTemplate, "entries"> & { entries: CategoryTemplateEntryView[] };

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
  templateExpectedTotal: number;
  contributionRequired: number;
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
