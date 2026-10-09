import type { GoalTimeline } from "./types";

const TIMELINE_END_MONTH: Record<GoalTimeline, "03" | "06" | "09" | "12"> = {
  T1: "03",
  T2: "06",
  T3: "09",
  T4: "12",
  ANUAL: "12",
};

/** Último mês da timeline num ano: T1=mar, T2=jun, T3=set, T4/ANUAL=dez. */
export function timelineEndMonth(timeline: GoalTimeline, year: number): string {
  return `${year}-${TIMELINE_END_MONTH[timeline]}`;
}

export type GoalYearTracking = {
  goalId: string;
  goalName: string;
  /** Orçamento-alvo (informação; não calcula percentagens). */
  target: number;
  plannedTotal: number;
  actualTotal: number;
  /** Alvo − reservado acumulado (negativo = acima do alvo). */
  missing: number;
  timelineEnd: string;
  /** Fim da timeline já passou/é o mês atual e o reservado fica abaixo do alvo. */
  atRisk: boolean;
};

/**
 * Acompanhamento anual por objetivo a partir dos planos mensais guardados.
 * Função pura: o orçamento é só comparado com os acumulados, nunca altera
 * a alocação por percentagens.
 */
export function goalYearTracking(input: {
  goals: { id: string; name: string; targetAmount: number; timeline: GoalTimeline }[];
  plans: { month: string; allocations: { goalId: string; planned: number; actual: number }[] }[];
  year: number;
  currentMonth: string;
}): GoalYearTracking[] {
  const prefix = `${input.year}-`;
  const totals = new Map<string, { planned: number; actual: number }>();
  for (const plan of input.plans) {
    if (!plan.month.startsWith(prefix)) continue;
    for (const entry of plan.allocations) {
      const total = totals.get(entry.goalId) ?? { planned: 0, actual: 0 };
      total.planned = Math.round((total.planned + entry.planned) * 100) / 100;
      total.actual = Math.round((total.actual + entry.actual) * 100) / 100;
      totals.set(entry.goalId, total);
    }
  }
  return input.goals.map((goal) => {
    const total = totals.get(goal.id) ?? { planned: 0, actual: 0 };
    const target = Math.round(goal.targetAmount * 100) / 100;
    const timelineEnd = timelineEndMonth(goal.timeline, input.year);
    return {
      goalId: goal.id,
      goalName: goal.name,
      target,
      plannedTotal: total.planned,
      actualTotal: total.actual,
      missing: Math.round((target - total.actual) * 100) / 100,
      timelineEnd,
      atRisk: timelineEnd <= input.currentMonth && total.actual < target,
    };
  });
}
