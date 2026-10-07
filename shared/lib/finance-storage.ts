import type { MonthlyPlan } from "@/features/monthly-plan/domain/types";

const STORAGE_KEY = "our-finances-monthly-plans";

function normalizePlan(fallback: MonthlyPlan, parsed: Partial<MonthlyPlan>): MonthlyPlan {
  return {
    ...fallback,
    ...parsed,
    people: parsed.people ?? fallback.people,
    expenses: parsed.expenses ?? fallback.expenses,
    transfers: parsed.transfers ?? fallback.transfers,
    goals: parsed.goals ?? fallback.goals,
  };
}

export function loadMonthlyPlans(fallback: MonthlyPlan[]): MonthlyPlan[] {
  if (typeof window === "undefined") return fallback;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const legacy = window.localStorage.getItem("our-finances-monthly-plan");
    if (!legacy) return fallback;
    try {
      return [normalizePlan(fallback[0], JSON.parse(legacy) as Partial<MonthlyPlan>)];
    } catch {
      return fallback;
    }
  }

  try {
    const parsed = JSON.parse(saved) as Partial<MonthlyPlan>[];
    return parsed.map((plan, index) => normalizePlan(fallback[index] ?? fallback[0], plan));
  } catch {
    return fallback;
  }
}

export function loadMonthlyPlan(fallback: MonthlyPlan): MonthlyPlan {
  return loadMonthlyPlans([fallback])[0];
}

export function saveMonthlyPlans(plans: MonthlyPlan[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function saveMonthlyPlan(plan: MonthlyPlan) {
  const plans = loadMonthlyPlans([plan]);
  const index = plans.findIndex((item) => item.month === plan.month);
  if (index === -1) plans.push(plan);
  else plans[index] = plan;
  saveMonthlyPlans(plans);
}

export function resetMonthlyPlan() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem("our-finances-monthly-plan");
}
