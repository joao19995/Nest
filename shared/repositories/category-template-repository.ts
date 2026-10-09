import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { CategoryTemplateEntry, CategoryTemplateEntryView, CategoryTemplateView } from "@/features/monthly-plan/domain/types";

type TemplateRow = { id: string; valid_from: string };

type EntryRow = {
  template_id: string;
  item_id: string;
  category_id: string;
  account_id: string;
  expected_amount: number | string;
  active: boolean;
  item_name: string;
  item_active: boolean;
  category_name: string;
  category_type: "FIXED" | "VARIABLE";
  category_active: boolean;
  account_name: string;
  account_active: boolean;
};

function toEntry(row: EntryRow): CategoryTemplateEntryView {
  return {
    itemId: row.item_id,
    categoryId: row.category_id,
    accountId: row.account_id,
    expectedAmount: Number(row.expected_amount),
    active: row.active,
    itemName: row.item_name,
    itemActive: row.item_active,
    categoryName: row.category_name,
    categoryType: row.category_type,
    categoryActive: row.category_active,
    accountName: row.account_name,
    accountActive: row.account_active,
  };
}

export class CategoryTemplateRepository {
  private async hydrate(templates: TemplateRow[]): Promise<CategoryTemplateView[]> {
    if (!templates.length) return [];
    const sql = getPostgres();
    const ids = templates.map((template) => template.id);
    const rows = await sql<EntryRow[]>`
      SELECT e.template_id, e.item_id, e.category_id, e.account_id, e.expected_amount, e.active,
              i.name AS item_name, i.active AS item_active,
              c.name AS category_name, c.type AS category_type, c.active AS category_active,
              a.name AS account_name, a.active AS account_active
      FROM category_template_entry e
      JOIN item i ON i.id = e.item_id
      JOIN category c ON c.id = e.category_id
      JOIN account a ON a.id = e.account_id
      WHERE e.template_id IN ${sql(ids)}
      ORDER BY c.name, i.name
    `;
    return templates.map((template) => ({
      id: template.id,
      validFrom: template.valid_from,
      entries: rows.filter((row) => row.template_id === template.id).map(toEntry),
    }));
  }

  async findAll(): Promise<CategoryTemplateView[]> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from FROM category_template ORDER BY valid_from`;
    return this.hydrate(templates);
  }

  async findById(id: string): Promise<CategoryTemplateView | null> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from FROM category_template WHERE id = ${id}`;
    return (await this.hydrate(templates))[0] ?? null;
  }

  async findByValidFrom(validFrom: string): Promise<CategoryTemplateView | null> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from FROM category_template WHERE valid_from = ${validFrom}`;
    return (await this.hydrate(templates))[0] ?? null;
  }

  // Template aplicável ao mês: o de validFrom mais recente que seja <= mês.
  async findApplicable(month: string): Promise<CategoryTemplateView | null> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from FROM category_template WHERE valid_from <= ${month} ORDER BY valid_from DESC LIMIT 1`;
    return (await this.hydrate(templates))[0] ?? null;
  }

  async findEntryPairs(templateId: string): Promise<Set<string>> {
    const sql = getPostgres();
    const rows = await sql<{ item_id: string; account_id: string }[]>`SELECT item_id, account_id FROM category_template_entry WHERE template_id = ${templateId}`;
    return new Set(rows.map((row) => `${row.item_id}|${row.account_id}`));
  }

  async findReferenceStatus(itemIds: string[], accountIds: string[]) {
    const sql = getPostgres();
    const items = itemIds.length ? await sql<{ id: string; active: boolean; category_id: string }[]>`SELECT id, active, category_id FROM item WHERE id IN ${sql(itemIds)}` : [];
    const accounts = accountIds.length ? await sql<{ id: string; active: boolean }[]>`SELECT id, active FROM account WHERE id IN ${sql(accountIds)}` : [];
    return {
      items: new Map(items.map((row) => [row.id, { active: row.active, categoryId: row.category_id }])),
      accounts: new Map(accounts.map((row) => [row.id, row.active])),
    };
  }

  async create(validFrom: string, entries: CategoryTemplateEntry[]): Promise<CategoryTemplateView> {
    const sql = getPostgres();
    const id = randomUUID();
    await sql.begin(async (transaction) => {
      await transaction`INSERT INTO category_template (id, valid_from) VALUES (${id}, ${validFrom})`;
      for (const entry of entries) {
        await transaction`
          INSERT INTO category_template_entry (id, template_id, item_id, category_id, account_id, expected_amount, active)
          VALUES (${randomUUID()}, ${id}, ${entry.itemId}, ${entry.categoryId}, ${entry.accountId}, ${entry.expectedAmount}, ${entry.active})
        `;
      }
    });
    return (await this.findById(id))!;
  }

  // Atualiza o conteúdo de uma versão sem apagar linhas: as entradas enviadas são inseridas/atualizadas
  // (por item) e as que deixaram de constar ficam active = FALSE (histórico preservado).
  async replaceEntries(id: string, entries: CategoryTemplateEntry[]): Promise<CategoryTemplateView | null> {
    const sql = getPostgres();
    await sql.begin(async (transaction) => {
      for (const entry of entries) {
        await transaction`
          INSERT INTO category_template_entry (id, template_id, item_id, category_id, account_id, expected_amount, active)
          VALUES (${randomUUID()}, ${id}, ${entry.itemId}, ${entry.categoryId}, ${entry.accountId}, ${entry.expectedAmount}, ${entry.active})
          ON CONFLICT (template_id, item_id)
          DO UPDATE SET category_id = EXCLUDED.category_id, account_id = EXCLUDED.account_id, expected_amount = EXCLUDED.expected_amount, active = EXCLUDED.active
        `;
      }
      const itemIds = entries.map((entry) => entry.itemId);
      if (itemIds.length) {
        await transaction`UPDATE category_template_entry SET active = FALSE WHERE template_id = ${id} AND active = TRUE AND item_id <> ALL(${itemIds}::uuid[])`;
      } else {
        await transaction`UPDATE category_template_entry SET active = FALSE WHERE template_id = ${id} AND active = TRUE`;
      }
    });
    return this.findById(id);
  }
}

export const categoryTemplateRepository = new CategoryTemplateRepository();
