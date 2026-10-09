export type Goal = {
  id: string;
  name: string;
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
