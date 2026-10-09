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

/** Soma em cêntimos, para comparar totais sem erros de vírgula flutuante. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Garante que a soma das alocações iguala o disponível ao cêntimo.
 * Lança AllocationError (INVALID_TOTAL) quando diverge — nesse caso o
 * chamador deve abortar a transação em vez de gravar um plano parcial.
 */
export function assertAllocationsTotal(
  allocations: Pick<AllocatedGoal, "planned">[],
  availableAmount: number,
): void {
  const plannedCents = allocations.reduce((sum, item) => sum + toCents(item.planned), 0);
  if (plannedCents !== toCents(availableAmount)) {
    throw new AllocationError(
      "INVALID_TOTAL",
      `A soma das alocações tem de igualar o disponível (${availableAmount.toFixed(2)} €).`,
    );
  }
}

export type StoredAllocation = {
  goalId: string;
  planned: number;
  actual: number;
};

/**
 * Sincronização pura do conjunto completo de alocações de um mês.
 *
 * Regra de integridade: cada recálculo sincroniza TODAS as linhas do mês.
 * - Objetivos incluídos no cálculo ficam com o planeado calculado (o
 *   reservado/atual é sempre preservado).
 * - Objetivos com linhas guardadas que já não fazem parte do cálculo
 *   (removidos da tabela ou objetivo desativado) ficam com planeado = 0,
 *   mantendo o atual e o histórico. Nunca são apagados fisicamente.
 *
 * Sem isto, uma linha obsoleta (ex.: Holidays com 400 €) somaria ao novo
 * total (ex.: Savings com 1000 €) e o mês fecharia em 1400 € em vez de
 * 1000 €. A implementação SQL em goal-plan-repository aplica exatamente
 * esta regra dentro da mesma transação do recálculo.
 */
export function syncStoredAllocations(input: {
  stored: StoredAllocation[];
  incoming: AllocatedGoal[];
}): StoredAllocation[] {
  const incomingByGoal = new Map(input.incoming.map((item) => [item.goalId, item.planned]));
  const storedByGoal = new Map(input.stored.map((item) => [item.goalId, item]));
  const result: StoredAllocation[] = [];
  // Primeiro as entradas do cálculo (ordem do template), depois as
  // obsoletas zeradas por goalId para determinismo.
  for (const item of input.incoming) {
    result.push({ goalId: item.goalId, planned: item.planned, actual: storedByGoal.get(item.goalId)?.actual ?? 0 });
  }
  const obsolete = input.stored
    .filter((item) => !incomingByGoal.has(item.goalId))
    .sort((a, b) => (a.goalId < b.goalId ? -1 : a.goalId > b.goalId ? 1 : 0));
  for (const item of obsolete) {
    result.push({ goalId: item.goalId, planned: 0, actual: item.actual });
  }
  return result;
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
