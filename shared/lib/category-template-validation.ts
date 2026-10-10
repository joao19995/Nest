import type { CategoryTemplateEntry } from "@/features/monthly-plan/domain/types";
import { isUuid } from "@/shared/lib/uuid";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function parseCategoryTemplateEntries(value: unknown): { entries: CategoryTemplateEntry[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "As entradas do template devem ser uma lista." };

  const seenCategories = new Set<string>();
  const entries: CategoryTemplateEntry[] = [];
  for (const item of value as Partial<CategoryTemplateEntry>[]) {
    if (!item || typeof item !== "object") return { error: "Entrada do template inválida." };
    if (typeof item.categoryId !== "string" || !isUuid(item.categoryId)) return { error: "ID de categoria inválido." };
    if (typeof item.accountId !== "string" || !isUuid(item.accountId)) return { error: "ID de conta inválido." };
    if (typeof item.expectedAmount !== "number" || !Number.isFinite(item.expectedAmount) || item.expectedAmount < 0) return { error: "O valor esperado deve ser um número não negativo." };
    if (typeof item.active !== "boolean") return { error: "O estado active deve ser booleano." };
    if (seenCategories.has(item.categoryId)) return { error: "A mesma categoria não pode aparecer duas vezes no template." };

    seenCategories.add(item.categoryId);
    entries.push({ categoryId: item.categoryId, accountId: item.accountId, expectedAmount: item.expectedAmount, active: item.active });
  }
  return { entries };
}

type ReferenceStatus = { categories: Map<string, boolean>; accounts: Map<string, boolean> };

// Categorias e contas inativas só são aceites se o mesmo par (categoria, conta) já existir nesta versão,
// para não bloquear entradas históricas. Nunca se substitui silenciosamente a conta escolhida.
export function checkEntryReferences(entries: CategoryTemplateEntry[], status: ReferenceStatus, existingPairs: Set<string>): string | null {
  for (const entry of entries) {
    const categoryActive = status.categories.get(entry.categoryId);
    if (categoryActive === undefined) return "Categoria não encontrada.";
    const accountActive = status.accounts.get(entry.accountId);
    if (accountActive === undefined) return "Conta não encontrada.";

    const isExisting = existingPairs.has(`${entry.categoryId}|${entry.accountId}`);
    if (!categoryActive && !isExisting) return "Uma categoria inativa não pode ser adicionada a um template.";
    if (!accountActive && !isExisting) return "Uma conta inativa não pode ser usada numa nova configuração do template.";
  }
  return null;
}
