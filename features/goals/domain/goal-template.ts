export type GoalTemplatePriority = "HIGH" | "MEDIUM" | "LOW";

export type GoalTemplateEntry = {
  goalId: string;
  percentage: number;
  priority: GoalTemplatePriority;
  deadlineMonth: string | null;
};

export type GoalTemplate = {
  id: string;
  validFrom: string; // YYYY-MM, primeira versão aplicável
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

// Montante anual por objetivo derivado da percentagem (fonte única: percentage).
export function annualAmountsFor(annualTotal: number, entries: GoalTemplateEntry[]): { goalId: string; amount: number }[] {
  return entries.map((entry) => ({ goalId: entry.goalId, amount: (annualTotal * entry.percentage) / 100 }));
}

// Template aplicável ao mês: o de validFrom mais recente que seja <= mês.
export function resolveApplicableGoalTemplateId(templates: { id: string; validFrom: string }[], month: string): string | null {
  return templates
    .filter((template) => template.validFrom <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .at(-1)?.id ?? null;
}

// Sugestão mensal a partir do template: available * percentagem, só para
// objetivos sem prazo vencido. O que sobra de prazos vencidos fica por distribuir.
export function suggestMonthlyFromTemplate(input: {
  availableAmount: number;
  entries: GoalTemplateEntry[];
  month: string;
}): { suggestions: { goalId: string; planned: number }[]; undistributed: number } {
  const available = Math.max(input.availableAmount, 0);
  const suggestions: { goalId: string; planned: number }[] = [];
  let distributed = 0;
  for (const entry of [...input.entries].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))) {
    if (entry.deadlineMonth && input.month > entry.deadlineMonth) continue;
    const planned = (available * entry.percentage) / 100;
    if (planned <= 0) continue;
    suggestions.push({ goalId: entry.goalId, planned });
    distributed += planned;
  }
  return { suggestions, undistributed: Math.max(available - distributed, 0) };
}

function priorityRank(priority: GoalTemplatePriority): number {
  return priority === "HIGH" ? 0 : priority === "MEDIUM" ? 1 : 2;
}
