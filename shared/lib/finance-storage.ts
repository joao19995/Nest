import type { FinanceState, FinancialConfiguration } from "@/features/monthly-plan/domain/types";
import { legacyAccountIds, legacyCategoryIds, legacyPersonIds } from "@/shared/lib/entity-seed-ids";
import { entitiesClient } from "@/shared/lib/entities-client";

const STORAGE_KEY = "our-finances-state";

function migrateLocalFinanceState(value: unknown, fallback: FinanceState): FinanceState {
  if (!value || typeof value !== "object") return fallback;

  const parsed = value as Partial<FinanceState>;
  const configuration = parsed.configuration ?? fallback.configuration;
  const { people: _people, accounts: _accounts, categories: _categories, ...localConfiguration } = configuration as FinancialConfiguration;

  return {
    configuration: {
      ...fallback.configuration,
      ...localConfiguration,
      people: fallback.configuration.people,
      accounts: fallback.configuration.accounts,
      categories: fallback.configuration.categories,
      emergencyFundMonths: configuration.emergencyFundMonths ?? fallback.configuration.emergencyFundMonths,
      incomes: configuration.incomes?.map((income) => ({
        ...income,
        personId: legacyPersonIds[income.personId] ?? income.personId,
        bonusMonths: income.bonusMonths ?? [],
      })) ?? fallback.configuration.incomes,
      contributionRules: configuration.contributionRules?.map((rule) => ({
        ...rule,
        personId: legacyPersonIds[rule.personId] ?? rule.personId,
      })) ?? fallback.configuration.contributionRules,
      categoryTemplates: (configuration.categoryTemplates?.length ? configuration.categoryTemplates : fallback.configuration.categoryTemplates).map((template) => ({
        ...template,
        entries: template.entries.map((entry) => ({ ...entry, categoryId: legacyCategoryIds[entry.categoryId] ?? entry.categoryId })),
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
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return fallback;

  try {
    return migrateLocalFinanceState(JSON.parse(saved), fallback);
  } catch {
    return fallback;
  }
}

export async function loadFinanceState(fallback: FinanceState): Promise<FinanceState> {
  const localState = loadLocalFinanceState(fallback);
  const [people, accounts, categories] = await Promise.all([
    entitiesClient.getPeople(),
    entitiesClient.getAccounts(),
    entitiesClient.getCategories(),
  ]);

  return {
    ...localState,
    configuration: { ...localState.configuration, people, accounts, categories },
  };
}

export function saveFinanceState(state: FinanceState) {
  const { people: _people, accounts: _accounts, categories: _categories, ...localConfiguration } = state.configuration;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, configuration: localConfiguration }));
}

export function resetFinanceState() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function showFinanceStorageError(error: unknown) {
  console.error("Finance data could not be loaded or saved.", error);
  window.alert("Não foi possível carregar os dados. Verifica a ligação à base de dados e tenta novamente.");
}
