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
  items: Item[];
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

// Item do Excel (Luz, Água, Internet...): pertence a uma Categoria (Casa).
// O template mensal e o plano mensal são por item (cada item tem a sua conta),
// por isso a mesma categoria pode ter itens em contas diferentes.
export type Item = {
  id: string;
  name: string;
  categoryId: string;
  active: boolean;
};

export type CategoryTemplate = {
  id: string;
  validFrom: string; // YYYY-MM, primeiro mês em que o template entra em vigor
  entries: CategoryTemplateEntry[];
};

export type CategoryTemplateEntry = {
  itemId: string;
  categoryId: string;
  accountId: string;
  expectedAmount: number;
  active: boolean;
};

// Vista da API: inclui nome e estado de item/categoria/conta para mostrar entradas históricas (mesmo inativas).
export type CategoryTemplateEntryView = CategoryTemplateEntry & {
  itemName: string;
  itemActive: boolean;
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
  itemId: string;
  itemName: string;
  itemActive: boolean;
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
