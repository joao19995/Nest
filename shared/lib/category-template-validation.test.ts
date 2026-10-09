import { describe, expect, it } from "vitest";
import { checkEntryReferences, parseCategoryTemplateEntries, resolveEntryCategories, type ReferenceStatus } from "./category-template-validation";

const ITEM_LUZ = "11111111-1111-4111-8111-111111111111";
const ITEM_AGUA = "22222222-2222-4222-8222-222222222222";
const ITEM_INATIVO = "33333333-3333-4333-8333-333333333333";
const CASA = "c472c0d6-4ae0-4835-bf58-34cc9801420a";
const CARRO = "20dd6cf8-9bb6-468b-86ac-bf47d3d96eae";
const CONJUNTA = "6c1dc1ca-6b0a-4ab2-8b24-25dc2d0b23be";
const JOAO = "2eb4767d-39eb-45d3-b280-281baab67a01";

const status: ReferenceStatus = {
  items: new Map([
    [ITEM_LUZ, { active: true, categoryId: CASA }],
    [ITEM_AGUA, { active: true, categoryId: CASA }],
    [ITEM_INATIVO, { active: false, categoryId: CARRO }],
  ]),
  accounts: new Map([[CONJUNTA, true], [JOAO, true]]),
};

describe("parseCategoryTemplateEntries (por item)", () => {
  it("aceita varias linhas da mesma categoria com contas diferentes", () => {
    const parsed = parseCategoryTemplateEntries([
      { itemId: ITEM_LUZ, accountId: CONJUNTA, expectedAmount: 60, active: true },
      { itemId: ITEM_AGUA, accountId: JOAO, expectedAmount: 20, active: true },
    ]);
    expect("error" in parsed).toBe(false);
  });

  it("rejeita o mesmo item duas vezes no template", () => {
    const parsed = parseCategoryTemplateEntries([
      { itemId: ITEM_LUZ, accountId: CONJUNTA, expectedAmount: 60, active: true },
      { itemId: ITEM_LUZ, accountId: JOAO, expectedAmount: 10, active: true },
    ]);
    expect(parsed).toEqual({ error: "O mesmo item não pode aparecer duas vezes no template." });
  });

  it("rejeita valores negativos e ids inválidos", () => {
    expect("error" in parseCategoryTemplateEntries([{ itemId: ITEM_LUZ, accountId: CONJUNTA, expectedAmount: -1, active: true }])).toBe(true);
    expect("error" in parseCategoryTemplateEntries([{ itemId: "x", accountId: CONJUNTA, expectedAmount: 1, active: true }])).toBe(true);
  });
});

describe("resolveEntryCategories", () => {
  it("preenche a categoria a partir do item (fonte única)", () => {
    const resolved = resolveEntryCategories([{ itemId: ITEM_AGUA, accountId: JOAO, expectedAmount: 20, active: true }], status.items);
    expect(resolved).toEqual({ entries: [{ itemId: ITEM_AGUA, categoryId: CASA, accountId: JOAO, expectedAmount: 20, active: true }] });
  });

  it("devolve erro para um item desconhecido", () => {
    const resolved = resolveEntryCategories([{ itemId: "44444444-4444-4444-8444-444444444444", accountId: JOAO, expectedAmount: 1, active: true }], status.items);
    expect(resolved).toEqual({ error: "Item não encontrado." });
  });
});

describe("checkEntryReferences", () => {
  it("bloqueia um item inativo numa nova configuração", () => {
    const error = checkEntryReferences([{ itemId: ITEM_INATIVO, categoryId: CARRO, accountId: JOAO, expectedAmount: 1, active: true }], status, new Set());
    expect(error).toBe("Um item inativo não pode ser adicionado a um template.");
  });

  it("permite um item inativo se o par (item, conta) já existia na versão (histórico)", () => {
    const existing = new Set([`${ITEM_INATIVO}|${JOAO}`]);
    const error = checkEntryReferences([{ itemId: ITEM_INATIVO, categoryId: CARRO, accountId: JOAO, expectedAmount: 1, active: true }], status, existing);
    expect(error).toBeNull();
  });

  it("aceita a mesma categoria com itens diferentes em contas diferentes", () => {
    const error = checkEntryReferences([
      { itemId: ITEM_LUZ, categoryId: CASA, accountId: CONJUNTA, expectedAmount: 60, active: true },
      { itemId: ITEM_AGUA, categoryId: CASA, accountId: JOAO, expectedAmount: 20, active: true },
    ], status, new Set());
    expect(error).toBeNull();
  });
});
