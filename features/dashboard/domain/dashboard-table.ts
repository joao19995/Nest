import type { MonthlyPlanView } from "@/features/monthly-plan/domain/types";

// Uma linha por mês do ano. Meses sem plano guardado ficam com null (mostram-se vazios, sem valores inventados).
export type DashboardRow = {
  month: string; // YYYY-MM
  hasPlan: boolean;
  // Valor actual por categoria escolhida; null = a categoria não existe nesse plano.
  actualByCategory: Record<string, number | null>;
  plannedTotal: number | null; // total do mês (todas as categorias, não só as escolhidas)
  actualTotal: number | null;
  deviation: number | null; // actual − planeado, em €
  deviationPct: number | null; // deviation / planeado × 100; null se o planeado for 0
};

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

// Desvio do mês face ao planeado: usa o total de todas as linhas do plano (não só as categorias escolhidas).
export function buildDashboardRows(year: number, plans: MonthlyPlanView[], categoryIds: string[]): DashboardRow[] {
  const plansByMonth = new Map(plans.map((plan) => [plan.month, plan]));
  return monthsOfYear(year).map((month) => {
    const plan = plansByMonth.get(month);
    if (!plan) {
      return { month, hasPlan: false, actualByCategory: Object.fromEntries(categoryIds.map((id) => [id, null])), plannedTotal: null, actualTotal: null, deviation: null, deviationPct: null };
    }
    const plannedTotal = plan.entries.reduce((total, entry) => total + entry.planned, 0);
    const actualTotal = plan.entries.reduce((total, entry) => total + entry.actual, 0);
    const deviation = actualTotal - plannedTotal;
    const actualByCategory = Object.fromEntries(categoryIds.map((id) => {
      const entry = plan.entries.find((candidate) => candidate.categoryId === id);
      return [id, entry ? entry.actual : null];
    }));
    return {
      month,
      hasPlan: true,
      actualByCategory,
      plannedTotal,
      actualTotal,
      deviation,
      deviationPct: plannedTotal > 0 ? (deviation / plannedTotal) * 100 : null,
    };
  });
}
