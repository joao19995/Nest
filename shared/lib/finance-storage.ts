import type { CategoryTemplate, CategoryTemplateEntry, FinanceState, FinancialConfiguration, Person, PersonIncome } from "@/features/monthly-plan/domain/types";
import { entitySeedIds, legacyAccountIds, legacyCategoryIds, legacyPersonIds } from "@/shared/lib/entity-seed-ids";
import { entitiesClient } from "@/shared/lib/entities-client";

const STORAGE_KEY = "our-finances-state";
type LegacyStoredCategory = { id: string; accountId?: unknown };
type LegacyIncome = { personId: string; periods: { amount: number; validFrom: string }[] };
type LegacyContributionRule = { personId: string; minimumAmount: number };
type LegacyConfiguration = Partial<FinancialConfiguration> & {
  categories?: LegacyStoredCategory[];
  incomes?: LegacyIncome[];
  dailySpendingPercentage?: number;
  emergencyFundMonths?: number;
  contributionRules?: LegacyContributionRule[];
};

export type LegacyPersonFinance = {
  dailySpendingPercentage?: number;
  emergencyFundMonths?: number;
  incomes: Pick<PersonIncome, "amount" | "validFrom">[];
};

export type LegacyPersonFinanceData = {
  byPersonId: Record<string, LegacyPersonFinance>;
  personIds: string[];
};

function parseStoredState() {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as { configuration?: LegacyConfiguration };
  } catch {
    return null;
  }
}

function personIdFromLegacy(id: string) {
  return legacyPersonIds[id] ?? id;
}

export function loadLegacyPersonFinanceData(): LegacyPersonFinanceData | null {
  const stored = parseStoredState();
  const legacy = stored?.configuration;
  if (!legacy) return null;

  const byPersonId: Record<string, LegacyPersonFinance> = {};
  const ensurePerson = (id: string) => byPersonId[personIdFromLegacy(id)] ??= { incomes: [] };
  const oldPeople = (legacy as LegacyConfiguration & { people?: { id: string }[] }).people ?? [];

  for (const person of oldPeople) ensurePerson(person.id);
  for (const income of legacy.incomes ?? []) {
    const finance = ensurePerson(income.personId);
    finance.incomes = income.periods.map((period) => ({
      amount: period.amount,
      validFrom: period.validFrom.length === 7 ? `${period.validFrom}-01` : period.validFrom,
    }));
  }

  if (legacy.dailySpendingPercentage !== undefined) {
    for (const finance of Object.values(byPersonId)) finance.dailySpendingPercentage = legacy.dailySpendingPercentage;
  }
  if (legacy.emergencyFundMonths !== undefined) {
    for (const finance of Object.values(byPersonId)) finance.emergencyFundMonths = legacy.emergencyFundMonths;
  }

  const hasLegacyFields = legacy.incomes !== undefined
    || legacy.dailySpendingPercentage !== undefined
    || legacy.emergencyFundMonths !== undefined
    || legacy.contributionRules !== undefined;

  return hasLegacyFields ? { byPersonId, personIds: Object.keys(byPersonId) } : null;
}

function migrateLocalFinanceState(value: unknown, fallback: FinanceState): FinanceState {
  if (!value || typeof value !== "object") return fallback;

  const parsed = value as Partial<FinanceState>;
  const configuration = (parsed.configuration ?? fallback.configuration) as LegacyConfiguration;
  const {
    people: _people,
    personIncomes: _personIncomes,
    accounts: _accounts,
    categories: _categories,
    incomes: _incomes,
    dailySpendingPercentage: _dailySpendingPercentage,
    emergencyFundMonths: _emergencyFundMonths,
    contributionRules: _contributionRules,
    ...localConfiguration
  } = configuration;
  const legacyCategories = (configuration as unknown as { categories?: LegacyStoredCategory[] }).categories ?? [];
  const legacyCategoryAccounts = new Map(legacyCategories.map((category) => {
    const categoryId = legacyCategoryIds[category.id] ?? category.id;
    const oldAccountId = category["accountId"];
    const accountId = typeof oldAccountId === "string" ? legacyAccountIds[oldAccountId] ?? oldAccountId : entitySeedIds.accounts.joint;
    return [categoryId, accountId] as const;
  }));

  return {
    configuration: {
      ...fallback.configuration,
      ...localConfiguration,
      people: fallback.configuration.people,
      personIncomes: fallback.configuration.personIncomes,
      accounts: fallback.configuration.accounts,
      categories: fallback.configuration.categories,
      categoryTemplates: (configuration.categoryTemplates?.length ? configuration.categoryTemplates : fallback.configuration.categoryTemplates).map((template) => ({
        ...template,
        entries: template.entries.map((entry) => {
          const legacyEntry = entry as CategoryTemplateEntry & { accountId?: string };
          const categoryId = legacyCategoryIds[entry.categoryId] ?? entry.categoryId;
          const accountId = legacyEntry.accountId
            ? legacyAccountIds[legacyEntry.accountId] ?? legacyEntry.accountId
            : legacyCategoryAccounts.get(categoryId) ?? entitySeedIds.accounts.joint;
          return { ...entry, categoryId, accountId };
        }),
      })),
    },
    annualPlans: parsed.annualPlans?.length ? parsed.annualPlans.map((plan) => ({ ...plan, allocations: plan.allocations ?? [] })) : fallback.annualPlans,
    months: (parsed.months?.length ? parsed.months : fallback.months).map((month) => ({
      ...month,
      expenses: month.expenses.map((expense) => ({
        ...expense,
        categoryId: legacyCategoryIds[expense.categoryId] ?? expense.categoryId,
        accountId: legacyAccountIds[expense.accountId] ?? expense.accountId,
      })),
    })),
  };
}

function loadLocalFinanceState(fallback: FinanceState): FinanceState {
  const stored = parseStoredState();
  return stored ? migrateLocalFinanceState(stored, fallback) : fallback;
}

function storedLocalCategoryTemplates(): CategoryTemplate[] {
  const configuration = parseStoredState()?.configuration as { categoryTemplates?: CategoryTemplate[] } | undefined;
  return configuration?.categoryTemplates ?? [];
}

function writeLocalCategoryTemplates(remaining: CategoryTemplate[]) {
  const stored = parseStoredState();
  if (!stored?.configuration) return;
  const configuration = { ...stored.configuration } as Record<string, unknown>;
  if (remaining.length) configuration.categoryTemplates = remaining;
  else delete configuration.categoryTemplates;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, configuration }));
}

// Importa uma única vez os templates antigos guardados no localStorage para o PostgreSQL.
// Um template cujo validFrom já exista na BD é descartado (a versão da BD prevalece).
// Templates que falhem a validação ficam no localStorage para revisão manual.
async function importLegacyCategoryTemplates(existing: CategoryTemplate[]) {
  const localTemplates = storedLocalCategoryTemplates();
  if (!localTemplates.length) return;

  const remaining: CategoryTemplate[] = [];
  for (const template of localTemplates) {
    if (existing.some((item) => item.validFrom === template.validFrom)) {
      console.warn(`Local category template ${template.validFrom} already exists in PostgreSQL; local copy discarded.`);
      continue;
    }
    try {
      await entitiesClient.createCategoryTemplate({
        validFrom: template.validFrom,
        entries: template.entries.map((entry) => ({
          categoryId: legacyCategoryIds[entry.categoryId] ?? entry.categoryId,
          accountId: legacyAccountIds[entry.accountId] ?? entry.accountId,
          expectedAmount: entry.expectedAmount,
          active: entry.active,
        })),
      });
    } catch (cause) {
      console.error(`Could not import local category template ${template.validFrom}.`, cause);
      remaining.push(template);
    }
  }
  writeLocalCategoryTemplates(remaining);
}

export async function loadFinanceState(fallback: FinanceState): Promise<FinanceState> {
  const localState = loadLocalFinanceState(fallback);
  const legacy = loadLegacyPersonFinanceData();
  let categoryTemplates = await entitiesClient.getCategoryTemplates();
  if (storedLocalCategoryTemplates().length) {
    await importLegacyCategoryTemplates(categoryTemplates);
    categoryTemplates = await entitiesClient.getCategoryTemplates();
  }
  const [people, accounts, categories] = await Promise.all([
    entitiesClient.getPeople(),
    entitiesClient.getAccounts(),
    entitiesClient.getCategories(),
  ]);
  const incomesByPerson = await Promise.all(people.map((person) => entitiesClient.getPersonIncomes(person.id)));
  const hydratedPeople: Person[] = [];
  const personIncomes: PersonIncome[] = [];

  people.forEach((person, index) => {
    const local = legacy?.byPersonId[person.id];
    const savedIncomes = incomesByPerson[index];
    const useLegacySettings = !!local && savedIncomes.length === 0 && isDefaultPersonFinance(person);
    hydratedPeople.push(useLegacySettings ? {
      ...person,
      dailySpendingPercentage: local.dailySpendingPercentage ?? person.dailySpendingPercentage,
      emergencyFundMonths: local.emergencyFundMonths ?? person.emergencyFundMonths,
    } : person);

    if (savedIncomes.length) {
      personIncomes.push(...savedIncomes);
    } else if (local?.incomes.length) {
      personIncomes.push(...local.incomes.map((income, incomeIndex) => ({
        ...income,
        id: `legacy:${person.id}:${income.validFrom}:${incomeIndex}`,
        personId: person.id,
      })));
    }
  });

  return {
    ...localState,
    configuration: { ...localState.configuration, people: hydratedPeople, personIncomes, accounts, categories, categoryTemplates },
  };
}

function isDefaultPersonFinance(person: Person) {
  return person.dailySpendingPercentage === 25
    && person.emergencyFundMonths === 6;
}

function readLegacyPersonFields() {
  const configuration = parseStoredState()?.configuration;
  if (!configuration) return {};
  return Object.fromEntries([
    "incomes",
    "dailySpendingPercentage",
    "emergencyFundMonths",
    "contributionRules",
    "categoryTemplates",
  ].filter((key) => key in configuration).map((key) => [key, (configuration as Record<string, unknown>)[key]]));
}

export function saveFinanceState(state: FinanceState) {
  const { people: _people, personIncomes: _personIncomes, accounts: _accounts, categories: _categories, categoryTemplates: _categoryTemplates, ...localConfiguration } = state.configuration;
  // categoryTemplates persistem na BD; só se mantêm no localStorage os valores legados ainda por importar.
  const legacyFields = readLegacyPersonFields();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, configuration: { ...legacyFields, ...localConfiguration } }));
}

export function clearLegacyPersonFinanceData() {
  const stored = parseStoredState();
  if (!stored?.configuration) return;
  const configuration = { ...stored.configuration } as Record<string, unknown>;
  delete configuration.incomes;
  delete configuration.dailySpendingPercentage;
  delete configuration.emergencyFundMonths;
  delete configuration.contributionRules;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, configuration }));
}

export function resetFinanceState() {
  const legacyFields = readLegacyPersonFields();
  if (Object.keys(legacyFields).length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ configuration: legacyFields }));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function showFinanceStorageError(error: unknown) {
  console.error("Finance data could not be loaded or saved.", error);
  window.alert("Não foi possível carregar os dados. Verifica a ligação à base de dados e tenta novamente.");
}
