import type { CategoryTemplateEntry } from "@/features/monthly-plan/domain/types";
import { isUuid } from "@/shared/lib/uuid";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

// Entrada vinda do cliente: o categoryId é resolvido no servidor a partir do
// item (fonte única), por isso aqui só se exige o itemId.
export type CategoryTemplateEntryInput = {
  itemId: string;
  accountId: string;
  expectedAmount: number;
  active: boolean;
};

export function parseCategoryTemplateEntries(value: unknown): { entries: CategoryTemplateEntryInput[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "As entradas do template devem ser uma lista." };

  const seenItems = new Set<string>();
  const entries: CategoryTemplateEntryInput[] = [];
  for (const item of value as Partial<CategoryTemplateEntryInput>[]) {
    if (!item || typeof item !== "object") return { error: "Entrada do template inválida." };
    if (typeof item.itemId !== "string" || !isUuid(item.itemId)) return { error: "ID de item inválido." };
    if (typeof item.accountId !== "string" || !isUuid(item.accountId)) return { error: "ID de conta inválido." };
    if (typeof item.expectedAmount !== "number" || !Number.isFinite(item.expectedAmount) || item.expectedAmount < 0) return { error: "O valor esperado deve ser um número não negativo." };
    if (typeof item.active !== "boolean") return { error: "O estado active deve ser booleano." };
    if (seenItems.has(item.itemId)) return { error: "O mesmo item não pode aparecer duas vezes no template." };

    seenItems.add(item.itemId);
    entries.push({ itemId: item.itemId, accountId: item.accountId, expectedAmount: item.expectedAmount, active: item.active });
  }
  return { entries };
}

export type ReferenceStatus = { items: Map<string, { active: boolean; categoryId: string }>; accounts: Map<string, boolean> };

// Resolve o categoryId de cada linha a partir do item (fonte única): o
// cliente envia só o itemId e o servidor preenche a categoria atual do item.
export function resolveEntryCategories(
  rows: CategoryTemplateEntryInput[],
  items: ReferenceStatus["items"],
): { entries: CategoryTemplateEntry[] } | { error: string } {
  const entries: CategoryTemplateEntry[] = [];
  for (const row of rows) {
    const item = items.get(row.itemId);
    if (!item) return { error: "Item não encontrado." };
    entries.push({ itemId: row.itemId, categoryId: item.categoryId, accountId: row.accountId, expectedAmount: row.expectedAmount, active: row.active });
  }
  return { entries };
}

// Itens e contas inativos só são aceites se o mesmo par (item, conta) já existir nesta versão,
// para não bloquear entradas históricas. Nunca se substitui silenciosamente a conta escolhida.
export function checkEntryReferences(entries: CategoryTemplateEntry[], status: ReferenceStatus, existingPairs: Set<string>): string | null {
  for (const entry of entries) {
    const item = status.items.get(entry.itemId);
    if (!item) return "Item não encontrado.";
    const accountActive = status.accounts.get(entry.accountId);
    if (accountActive === undefined) return "Conta não encontrada.";

    const isExisting = existingPairs.has(`${entry.itemId}|${entry.accountId}`);
    if (!item.active && !isExisting) return "Um item inativo não pode ser adicionado a um template.";
    if (!accountActive && !isExisting) return "Uma conta inativa não pode ser usada numa nova configuração do template.";
  }
  return null;
}
