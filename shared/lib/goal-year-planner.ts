import { allocateMonth, AllocationError } from "../../features/goals/domain/allocate-month";
import { resolveApplicableGoalTemplate } from "../../features/goals/domain/goal-template";
import type { GoalTemplate } from "../../features/goals/domain/goal-template";

export type YearSeed = {
  month: string;
  availableAmount: number;
  allocations: { goalId: string; planned: number }[];
};

/**
 * Calcula a semente de alocação dos 12 meses do ano. Para cada mês resolve
 * o template aplicável e distribui o disponível com cent-exactidão.
 * Meses sem template aplicável são reportados em missingMonths em vez de
 * se inventar uma distribuição.
 */
export function buildYearSeeds(input: {
  year: number;
  funding: { month: string; available: number }[];
  templates: GoalTemplate[];
}): { seeds: YearSeed[]; missingMonths: string[] } {
  const seeds: YearSeed[] = [];
  const missingMonths: string[] = [];
  for (const item of input.funding) {
    if (!item.month.startsWith(`${input.year}-`)) continue;
    const template = resolveApplicableGoalTemplate(input.templates, item.month);
    if (!template || !template.entries.length) {
      missingMonths.push(item.month);
      continue;
    }
    const { allocations } = allocateMonth({ availableAmount: item.available, entries: template.entries });
    seeds.push({ month: item.month, availableAmount: Math.round(item.available * 100) / 100, allocations });
  }
  return { seeds, missingMonths };
}

export function yearMonthsOf(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export type StoredMonthPlan = {
  planId: string;
  month: string;
  availableAmount: number;
  closed: boolean;
  allocations: { goalId: string; planned: number }[];
};

export type TemplateChangePreview = {
  /** Meses abertos que vão mudar (antes/depois), ordenados. */
  affected: FutureChange[];
  /** Meses fechados no alcance da versão: permanecem byte-por-byte iguais. */
  closedSkipped: string[];
  /** Meses abertos sem tabela aplicável: mantidos como estão. */
  missingMonths: string[];
};

/**
 * Antevisão pura (só leitura) do efeito de uma versão de tabela — nova ou
 * editada — sobre os meses guardados. Não escreve nada: o chamador decide
 * se confirma. O alcance começa em `validFrom`: meses anteriores nunca
 * mudam e meses fechados são listados em `closedSkipped` em vez de
 * recalculados.
 */
export function previewTemplateChange(input: {
  validFrom: string;
  proposedEntries: { goalId: string; percentage: number }[];
  storedPlans: StoredMonthPlan[];
  fundingByMonth: Map<string, number>;
  templates: GoalTemplate[];
  /** Id da versão editada (para substituir na resolução); omitir ao criar. */
  replacedId?: string;
  /** Versão proposta (usada na resolução em vez da versão editada). */
  proposedId?: string;
}): TemplateChangePreview {
  const effective: GoalTemplate[] = input.templates.filter((template) => template.id !== (input.replacedId ?? "\0"));
  effective.push({
    id: input.proposedId ?? "preview",
    validFrom: input.validFrom,
    annualTotal: 0,
    entries: input.proposedEntries,
  });
  const affected: FutureChange[] = [];
  const closedSkipped: string[] = [];
  const missingMonths: string[] = [];
  const ordered = [...input.storedPlans].sort((a, b) => a.month.localeCompare(b.month));
  for (const stored of ordered) {
    if (stored.month < input.validFrom) continue;
    if (stored.closed) {
      closedSkipped.push(stored.month);
      continue;
    }
    const available = input.fundingByMonth.get(stored.month);
    if (available === undefined) continue;
    const template = resolveApplicableGoalTemplate(effective, stored.month);
    if (!template || !template.entries.length) {
      missingMonths.push(stored.month);
      continue;
    }
    let recalculated: { goalId: string; planned: number }[];
    try {
      recalculated = allocateMonth({ availableAmount: available, entries: template.entries }).allocations;
    } catch (cause) {
      if (cause instanceof AllocationError) {
        missingMonths.push(stored.month);
        continue;
      }
      throw cause;
    }
    const before = stored.allocations.map((item) => ({ goalId: item.goalId, planned: item.planned }));
    const beforeByGoal = new Map(before.map((item) => [item.goalId, item.planned]));
    const changed =
      Math.abs(stored.availableAmount - available) > 0.005 ||
      recalculated.some((item) => Math.abs((beforeByGoal.get(item.goalId) ?? -1) - item.planned) > 0.005) ||
      recalculated.length !== before.length;
    if (changed) {
      affected.push({
        month: stored.month,
        availableAmount: Math.round(available * 100) / 100,
        before,
        after: recalculated,
      });
    }
  }
  return { affected, closedSkipped, missingMonths };
}

export type FutureChange = {
  month: string;
  availableAmount: number;
  before: { goalId: string; planned: number }[];
  after: { goalId: string; planned: number }[];
};

/**
 * Ajuste manual de um mês: o mês ajustado fica exatamente como o utilizador
 * definiu (o template nunca é alterado) e os futuros meses abertos são
 * recalculados com o template aplicável a cada mês. Meses fechados nunca
 * são incluídos; meses sem template aplicável são reportados, não inventados.
 * Função pura para poder ser testada sem base de dados.
 */
export function computeAdjustRecalc(input: {
  targetMonth: string;
  targetAvailable: number;
  targetAllocations: { goalId: string; planned: number }[];
  storedPlans: StoredMonthPlan[];
  fundingByMonth: Map<string, number>;
  templates: GoalTemplate[];
}): {
  toApply: { planId: string; availableAmount: number; allocations: { goalId: string; planned: number }[] }[];
  futureChanges: FutureChange[];
  missingMonths: string[];
  /** Futuros meses fechados: ficam imutáveis, listados para a UI os identificar. */
  closedSkipped: string[];
} {
  const target = input.storedPlans.find((item) => item.month === input.targetMonth);
  if (!target) throw new Error("Mês não encontrado.");
  const toApply: { planId: string; availableAmount: number; allocations: { goalId: string; planned: number }[] }[] = [
    { planId: target.planId, availableAmount: input.targetAvailable, allocations: input.targetAllocations },
  ];
  const futureChanges: FutureChange[] = [];
  const missingMonths: string[] = [];
  const closedSkipped: string[] = [];
  for (const stored of input.storedPlans) {
    if (stored.month <= input.targetMonth) continue;
    if (stored.closed) {
      closedSkipped.push(stored.month);
      continue;
    }
    const available = input.fundingByMonth.get(stored.month);
    if (available === undefined) continue;
    const template = resolveApplicableGoalTemplate(input.templates, stored.month);
    if (!template || !template.entries.length) {
      missingMonths.push(stored.month);
      continue;
    }
    let recalculated: { goalId: string; planned: number }[];
    try {
      recalculated = allocateMonth({ availableAmount: available, entries: template.entries }).allocations;
    } catch (cause) {
      if (cause instanceof AllocationError) {
        missingMonths.push(stored.month);
        continue;
      }
      throw cause;
    }
    const before = stored.allocations.map((item) => ({ goalId: item.goalId, planned: item.planned }));
    const beforeByGoal = new Map(before.map((item) => [item.goalId, item.planned]));
    const changed =
      Math.abs(stored.availableAmount - available) > 0.005 ||
      recalculated.some((item) => Math.abs((beforeByGoal.get(item.goalId) ?? -1) - item.planned) > 0.005) ||
      recalculated.length !== before.length;
    if (changed) {
      futureChanges.push({
        month: stored.month,
        availableAmount: Math.round(available * 100) / 100,
        before,
        after: recalculated,
      });
      toApply.push({ planId: stored.planId, availableAmount: Math.round(available * 100) / 100, allocations: recalculated });
    }
  }
  return { toApply, futureChanges, missingMonths, closedSkipped };
}
