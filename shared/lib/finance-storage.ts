import type { FinanceState } from "@/features/monthly-plan/domain/types";

const STORAGE_KEY = "our-finances-state";

export function loadFinanceState(fallback: FinanceState): FinanceState {
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved) as Partial<FinanceState>;
    const configuration = parsed.configuration ?? fallback.configuration;
    return {
      configuration: {
        ...fallback.configuration,
        ...configuration,
        emergencyFundMonths: configuration.emergencyFundMonths ?? fallback.configuration.emergencyFundMonths,
        incomes: configuration.incomes?.map((income) => ({ ...income, bonusMonths: income.bonusMonths ?? [] })) ?? fallback.configuration.incomes,
        categories: configuration.categories?.map((category) => ({ id: category.id, name: category.name, type: category.type ?? "normal", accountId: category.accountId ?? "joint" })) ?? fallback.configuration.categories,
        categoryTemplates: configuration.categoryTemplates?.length ? configuration.categoryTemplates : fallback.configuration.categoryTemplates,
      },
      annualPlans: parsed.annualPlans?.length ? parsed.annualPlans.map((plan) => ({ ...plan, allocations: plan.allocations ?? [] })) : fallback.annualPlans,
      months: parsed.months?.length ? parsed.months : fallback.months,
    };
  } catch {
    return fallback;
  }
}

export function saveFinanceState(state: FinanceState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetFinanceState() {
  window.localStorage.removeItem(STORAGE_KEY);
}
