export type AllocationEntry = {
  goalId: string;
  percentage: number;
};

export type AllocatedGoal = {
  goalId: string;
  /** Euros, cent-exact (2 decimals). The sum always equals the available amount. */
  planned: number;
};

export const TEMPLATE_TOTAL_TOLERANCE = 0.01;

export class AllocationError extends Error {
  readonly code: "NO_TEMPLATE" | "INVALID_TOTAL" | "INVALID_PERCENTAGE" | "INVALID_AVAILABLE";
  constructor(code: AllocationError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Deterministic monthly allocation: every cent of the available amount is
 * distributed across the template goals, so the planned values always sum
 * exactly to the available amount. Uses the largest-remainder method on
 * euro cents with a goalId tie-break, so the same input always yields the
 * same output. A goal such as Savings is treated like any other goal.
 *
 * - availableAmount <= 0 → every goal gets 0.
 * - no entries → throws NO_TEMPLATE (missing configuration, never invented).
 * - percentages not totalling 100% (tolerance 0.01) → throws INVALID_TOTAL.
 */
export function allocateMonth(input: {
  availableAmount: number;
  entries: AllocationEntry[];
}): { allocations: AllocatedGoal[] } {
  const { availableAmount, entries } = input;
  if (typeof availableAmount !== "number" || !Number.isFinite(availableAmount) || availableAmount < 0) {
    throw new AllocationError("INVALID_AVAILABLE", "O valor disponível tem de ser um número não negativo.");
  }
  if (!entries.length) {
    throw new AllocationError("NO_TEMPLATE", "Não existe tabela aplicável a este mês. Cria a tabela anual primeiro.");
  }
  for (const entry of entries) {
    if (typeof entry.percentage !== "number" || !Number.isFinite(entry.percentage) || entry.percentage < 0 || entry.percentage > 100) {
      throw new AllocationError("INVALID_PERCENTAGE", "Cada percentagem deve estar entre 0 e 100.");
    }
  }
  const total = entries.reduce((sum, entry) => sum + entry.percentage, 0);
  if (Math.abs(total - 100) >= TEMPLATE_TOTAL_TOLERANCE) {
    throw new AllocationError("INVALID_TOTAL", `A tabela tem de somar 100% (atual: ${total.toFixed(2)}%).`);
  }

  const totalCents = Math.round(availableAmount * 100);
  if (totalCents === 0) {
    return { allocations: entries.map((entry) => ({ goalId: entry.goalId, planned: 0 })) };
  }

  const ranked = entries.map((entry) => {
    const exact = (totalCents * entry.percentage) / 100;
    const base = Math.floor(exact);
    return { goalId: entry.goalId, base, fraction: exact - base };
  });
  let remainder = totalCents - ranked.reduce((sum, item) => sum + item.base, 0);
  ranked.sort((a, b) => b.fraction - a.fraction || (a.goalId < b.goalId ? -1 : a.goalId > b.goalId ? 1 : 0));
  for (let index = 0; index < ranked.length && remainder > 0; index += 1, remainder -= 1) {
    ranked[index].base += 1;
  }
  const plannedByGoal = new Map(ranked.map((item) => [item.goalId, item.base / 100]));
  // Preserve the template entry order in the output.
  return { allocations: entries.map((entry) => ({ goalId: entry.goalId, planned: plannedByGoal.get(entry.goalId) ?? 0 })) };
}
