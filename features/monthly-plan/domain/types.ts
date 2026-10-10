export type Person = {
  id: string;
  name: string;
  dailySpendingPercentage: number;
  emergencyFundMonths: number;
  individualFixedAmount: number;
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
};

export type FinanceState = {
  configuration: FinancialConfiguration;
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

// Mês persistido: planned é um snapshot do template (imutável); actual é editável enquanto o mês estiver aberto.
export type MonthlyPlanEntryView = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryType: Category["type"];
  accountId: string;
  accountName: string;
  accountOwnerPersonId: string | null;
  planned: number;
  actual: number;
};

export type MonthlyPlanView = {
  id: string;
  month: string; // YYYY-MM
  templateId: string;
  closed: boolean;
  entries: MonthlyPlanEntryView[];
};
