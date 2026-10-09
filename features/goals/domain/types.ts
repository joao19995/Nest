export type GoalPriority = "GRANDE" | "PEQUENO" | "NICE_TO_HAVE";

export type GoalTimeline = "T1" | "T2" | "T3" | "T4" | "ANUAL";

export type Goal = {
  id: string;
  name: string;
  /** Orçamento-alvo (informação e acompanhamento; não calcula percentagens). */
  targetAmount: number;
  /** Categoria do Excel: GRANDE / PEQUENO / NICE TO HAVE. */
  priority: GoalPriority;
  /** T1..T4 ou ANUAL. */
  timeline: GoalTimeline;
  /** Realismo (texto livre curto). */
  realism: string;
  /** Impacto/porquê (texto). */
  notes: string;
};

export type GoalYearReview = {
  goalId: string;
  year: number;
  /** Felicidade no fim do ano, 1–5 (null = por avaliar). */
  happiness: number | null;
  /** Reflexão/lição do ano. */
  reflection: string;
};

export type GoalPlanMonth = {
  id: string;
  month: string; // YYYY-MM
  availableAmount: number;
  closed: boolean;
};

// Alocação mensal de um objetivo: planned = reserva, actual = executado.
export type GoalAllocation = {
  month: string; // YYYY-MM
  goalId: string;
  planned: number;
  actual: number;
};

export type GoalMonthlyAvailability = {
  month: string; // YYYY-MM
  availableAmount: number;
};

export type GoalPlannedSuggestion = {
  month: string; // YYYY-MM
  goalId: string;
  planned: number;
};

export type GoalDeficit = {
  goalId: string;
  missing: number;
};
