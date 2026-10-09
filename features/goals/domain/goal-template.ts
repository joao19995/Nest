export type GoalTemplateEntry = {
  goalId: string;
  percentage: number;
};

export type GoalTemplate = {
  id: string;
  validFrom: string; // YYYY-MM, primeira versão aplicável
  /**
   * Informational snapshot of the year's funding when the version was saved.
   * Never used as a budget: allocation always derives from percentages
   * applied to each month's stored available amount.
   */
  annualTotal: number;
  entries: GoalTemplateEntry[];
};

// A tabela anual tem de dar 100%: tolerância de 0.01 por arredondamentos.
export function totalPercentage(entries: Pick<GoalTemplateEntry, "percentage">[]): number {
  return entries.reduce((total, entry) => total + entry.percentage, 0);
}

export function isValidTemplateTotal(entries: Pick<GoalTemplateEntry, "percentage">[]): boolean {
  return Math.abs(totalPercentage(entries) - 100) < 0.01;
}

// Template aplicável ao mês: o de validFrom mais recente que seja <= mês.
export function resolveApplicableGoalTemplateId(templates: { id: string; validFrom: string }[], month: string): string | null {
  return templates
    .filter((template) => template.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.id ?? null;
}

export function resolveApplicableGoalTemplate<T extends { id: string; validFrom: string }>(
  templates: T[],
  month: string,
): T | null {
  return templates
    .filter((template) => template.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1) ?? null;
}

/**
 * Versões que impedem a desativação de um objetivo: têm percentagem > 0
 * para esse objetivo E aplicam-se a algum mês aberto, ou são a última
 * versão (que governará os próximos meses a criar). Desativar nesses casos
 * deixaria meses sem distribuição válida — é preciso criar primeiro uma
 * nova versão da tabela sem esse objetivo. Percentagem 0 nunca bloqueia:
 * esse objetivo não recebe dinheiro nenhum.
 */
export function findDeactivationBlockers(input: {
  goalId: string;
  templates: GoalTemplate[];
  openMonths: string[];
}): GoalTemplate[] {
  const ordered = [...input.templates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const latest = ordered.at(-1);
  const funded = (template: GoalTemplate) =>
    template.entries.some((entry) => entry.goalId === input.goalId && entry.percentage > 0);
  return ordered.filter(
    (template) =>
      funded(template) &&
      (template.id === latest?.id ||
        input.openMonths.some((month) => resolveApplicableGoalTemplate(ordered, month)?.id === template.id)),
  );
}
