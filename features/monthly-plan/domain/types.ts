export type Person = {
  name: string;
  income: number;
  incomeHistory: IncomeRecord[];
  annualSubsidies?: number;
  fixedExpenses: number;
  dailyAmount: number;
  budget: number;
};

export type IncomeRecord = {
  amount: number;
  validFrom: string;
};

export type Expense = {
  category: string;
  planned: number;
  actual: number;
};

export type MonthlyTransfer = {
  person: string;
  amount: number;
  account: string;
};

export type Goal = {
  name: string;
  target: number;
  allocated: number;
  color: string;
  period: string;
  priority: "Grande" | "Nice to have";
  notes: string;
};

export type MonthlyPlan = {
  month: string;
  people: Person[];
  expenses: Expense[];
  transfers: MonthlyTransfer[];
  goals: Goal[];
};

export type MonthlySummary = {
  income: number;
  plannedExpenses: number;
  actualExpenses: number;
  surplus: number;
  emergencyFund: number;
  emergencyFundByPerson: { person: string; amount: number }[];
  transfers: number;
  dayToDay: number;
};
