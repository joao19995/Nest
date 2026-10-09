import { allocateMonth, AllocationError } from "../../features/goals/domain/allocate-month";
import { resolveApplicableGoalTemplate } from "../../features/goals/domain/goal-template";
import type { GoalTemplate } from "../../features/goals/domain/goal-template";

export type YearSeed = {
  month: string;
  availableAmount: number;
  allocations: { goalId: string; planned: number }[];
};

export type InvalidGoalMonth = {
  month: string;
  reason: string;
};

/**
 * Objetivos inativos nunca recebem dinheiro: se a tabela dá percentagem > 0
 * a um objetivo inativo, o mês é inválido e não é gravado. Não se
 * redistribuem percentagens em silêncio — devolve o id do objetivo para o
 * motivo. Percentagem 0 é inofensiva (não atribui dinheiro).
 */
function inactiveFundedGoalId(
  entries: { goalId: string; percentage: number }[],
  activeGoalIds: ReadonlySet<string>,
): { goalId: string; percentage: number } | null {
  return entries.find((entry) => entry.percentage > 0 && !activeGoalIds.has(entry.goalId)) ?? null;
}

function inactiveGoalReason(month: string, goalId: string, percentage: number): InvalidGoalMonth {
  return {
    month,
    reason: `Objetivo inativo (${goalId}) com ${percentage}% na tabela aplicável — cria uma nova versão do template sem esse objetivo.`,
  };
}

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
  activeGoalIds: ReadonlySet<string>;
}): { seeds: YearSeed[]; missingMonths: string[]; invalidMonths: InvalidGoalMonth[] } {
  const seeds: YearSeed[] = [];
  const missingMonths: string[] = [];
  const invalidMonths: InvalidGoalMonth[] = [];
  for (const item of input.funding) {
    if (!item.month.startsWith(`${input.year}-`)) continue;
    const template = resolveApplicableGoalTemplate(input.templates, item.month);
    if (!template || !template.entries.length) {
      missingMonths.push(item.month);
      continue;
    }
    const inactive = inactiveFundedGoalId(template.entries, input.activeGoalIds);
    if (inactive) {
      invalidMonths.push(inactiveGoalReason(item.month, inactive.goalId, inactive.percentage));
      continue;
    }
    const { allocations } = allocateMonth({ availableAmount: item.available, entries: template.entries });
    seeds.push({ month: item.month, availableAmount: Math.round(item.available * 100) / 100, allocations });
  }
  return { seeds, missingMonths, invalidMonths };
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
  /** Meses sem plano guardado que vão ser criados no intervalo, ordenados. */
  toCreate: string[];
  /** Meses fechados no alcance da versão: permanecem byte-por-byte iguais. */
  closedSkipped: string[];
  /** Meses abertos sem tabela aplicável: mantidos como estão. */
  missingMonths: string[];
  /** Meses inválidos (tabela dá dinheiro a objetivo inativo): não gravados. */
  invalidMonths: InvalidGoalMonth[];
};

/**
 * Conjunto ÚNICO de meses que uma mudança de tabela pode tocar — partilhado
 * pelo preview e pela gravação para que ambos vejam exatamente o mesmo
 * conjunto: meses abertos com mês >= `validFrom` (mais criar os meses em
 * falta nesse intervalo). Meses anteriores e fechados nunca são tocados.
 * Só entram seeds de meses guardados cujo recálculo difere do atual, mais
 * os meses a criar. `templates` já traz a proposta aplicada (versão editada
 * substituída / nova versão adicionada).
 */
export function buildTemplateChangeSeeds(input: {
  year: number;
  validFrom: string;
  fundingByMonth: Map<string, number>;
  storedPlans: StoredMonthPlan[];
  templates: GoalTemplate[];
  activeGoalIds: ReadonlySet<string>;
}): { seeds: YearSeed[]; toCreate: string[]; closedSkipped: string[]; missingMonths: string[]; invalidMonths: InvalidGoalMonth[] } {
  const prefix = `${input.year}-`;
  const storedByMonth = new Map(input.storedPlans.map((item) => [item.month, item]));
  const months = new Set<string>();
  for (const stored of input.storedPlans) {
    if (stored.month.startsWith(prefix) && stored.month >= input.validFrom) months.add(stored.month);
  }
  for (const month of Array.from(input.fundingByMonth.keys())) {
    if (month.startsWith(prefix) && month >= input.validFrom) months.add(month);
  }
  const seeds: YearSeed[] = [];
  const toCreate: string[] = [];
  const closedSkipped: string[] = [];
  const missingMonths: string[] = [];
  const invalidMonths: InvalidGoalMonth[] = [];
  for (const month of Array.from(months).sort()) {
    const stored = storedByMonth.get(month);
    if (stored?.closed) {
      closedSkipped.push(month);
      continue;
    }
    const available = input.fundingByMonth.get(month);
    if (available === undefined) continue;
    const template = resolveApplicableGoalTemplate(input.templates, month);
    if (!template || !template.entries.length) {
      missingMonths.push(month);
      continue;
    }
    const inactive = inactiveFundedGoalId(template.entries, input.activeGoalIds);
    if (inactive) {
      invalidMonths.push(inactiveGoalReason(month, inactive.goalId, inactive.percentage));
      continue;
    }
    let recalculated: { goalId: string; planned: number }[];
    try {
      recalculated = allocateMonth({ availableAmount: available, entries: template.entries }).allocations;
    } catch (cause) {
      if (cause instanceof AllocationError) {
        missingMonths.push(month);
        continue;
      }
      throw cause;
    }
    if (!stored) {
      seeds.push({ month, availableAmount: Math.round(available * 100) / 100, allocations: recalculated });
      toCreate.push(month);
      continue;
    }
    const beforeByGoal = new Map(stored.allocations.map((item) => [item.goalId, item.planned]));
    const changed =
      Math.abs(stored.availableAmount - available) > 0.005 ||
      recalculated.some((item) => Math.abs((beforeByGoal.get(item.goalId) ?? -1) - item.planned) > 0.005) ||
      recalculated.length !== stored.allocations.length;
    if (changed) {
      seeds.push({ month, availableAmount: Math.round(available * 100) / 100, allocations: recalculated });
    }
  }
  return { seeds, toCreate, closedSkipped, missingMonths, invalidMonths };
}

/**
 * Antevisão pura (só leitura) do efeito de uma versão de tabela — nova ou
 * editada — sobre os meses guardados. Não escreve nada: o chamador decide
 * se confirma. O alcance começa em `validFrom`: meses anteriores nunca
 * mudam e meses fechados são listados em `closedSkipped` em vez de
 * recalculados. O `affected` corresponde exatamente às seeds que a gravação
 * aplicaria (mais `toCreate` para os meses a criar).
 */
export function previewTemplateChange(input: {
  validFrom: string;
  proposedEntries: { goalId: string; percentage: number }[];
  storedPlans: StoredMonthPlan[];
  fundingByMonth: Map<string, number>;
  templates: GoalTemplate[];
  activeGoalIds: ReadonlySet<string>;
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
  const scope = buildTemplateChangeSeeds({
    year: Number(input.validFrom.slice(0, 4)),
    validFrom: input.validFrom,
    fundingByMonth: input.fundingByMonth,
    storedPlans: input.storedPlans,
    templates: effective,
    activeGoalIds: input.activeGoalIds,
  });
  const storedByMonth = new Map(input.storedPlans.map((item) => [item.month, item]));
  const affected: FutureChange[] = [];
  for (const seed of scope.seeds) {
    const stored = storedByMonth.get(seed.month);
    if (!stored) continue;
    affected.push({
      month: seed.month,
      availableAmount: seed.availableAmount,
      before: stored.allocations.map((item) => ({ goalId: item.goalId, planned: item.planned })),
      after: seed.allocations,
    });
  }
  return { affected, toCreate: scope.toCreate, closedSkipped: scope.closedSkipped, missingMonths: scope.missingMonths, invalidMonths: scope.invalidMonths };
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
  activeGoalIds: ReadonlySet<string>;
}): {
  toApply: { planId: string; availableAmount: number; allocations: { goalId: string; planned: number }[] }[];
  futureChanges: FutureChange[];
  missingMonths: string[];
  /** Futuros meses fechados: ficam imutáveis, listados para a UI os identificar. */
  closedSkipped: string[];
  /** Futuros meses inválidos (tabela dá dinheiro a objetivo inativo): não gravados. */
  invalidMonths: InvalidGoalMonth[];
} {
  const target = input.storedPlans.find((item) => item.month === input.targetMonth);
  if (!target) throw new Error("Mês não encontrado.");
  const toApply: { planId: string; availableAmount: number; allocations: { goalId: string; planned: number }[] }[] = [
    { planId: target.planId, availableAmount: input.targetAvailable, allocations: input.targetAllocations },
  ];
  const futureChanges: FutureChange[] = [];
  const missingMonths: string[] = [];
  const closedSkipped: string[] = [];
  const invalidMonths: InvalidGoalMonth[] = [];
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
    const inactive = inactiveFundedGoalId(template.entries, input.activeGoalIds);
    if (inactive) {
      invalidMonths.push(inactiveGoalReason(stored.month, inactive.goalId, inactive.percentage));
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
  return { toApply, futureChanges, missingMonths, closedSkipped, invalidMonths };
}
