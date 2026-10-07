import type { FinanceState } from "@/features/monthly-plan/domain/types";

const STORAGE_KEY = "our-finances-state";

export function loadFinanceState(fallback: FinanceState): FinanceState {
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved) as Partial<FinanceState>;
    return {
      configuration: parsed.configuration ?? fallback.configuration,
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
