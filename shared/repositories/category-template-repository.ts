import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { CategoryTemplateEntry, CategoryTemplateEntryView, CategoryTemplateView } from "@/features/monthly-plan/domain/types";

type TemplateRow = { id: string; valid_from: string };

type EntryRow = {
  template_id: string;
  category_id: string;
  account_id: string;
  expected_amount: number | string;
  active: boolean;
  category_name: string;
  category_type: "FIXED" | "VARIABLE";
  category_active: boolean;
  account_name: string;
  account_active: boolean;
};

function toEntry(row: EntryRow): CategoryTemplateEntryView {
  return {
    categoryId: row.category_id,
    accountId: row.account_id,
    expectedAmount: Number(row.expected_amount),
    active: row.active,
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
      SELECT e.template_id, e.category_id, e.account_id, e.expected_amount, e.active,
             c.name AS category_name, c.type AS category_type, c.active AS category_active,
             a.name AS account_name, a.active AS account_active
      FROM category_template_entry e
      JOIN category c ON c.id = e.category_id
      JOIN account a ON a.id = e.account_id
      WHERE e.template_id IN ${sql(ids)}
      ORDER BY c.name
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
    const rows = await sql<{ category_id: string; account_id: string }[]>`SELECT category_id, account_id FROM category_template_entry WHERE template_id = ${templateId}`;
    return new Set(rows.map((row) => `${row.category_id}|${row.account_id}`));
  }

  async findReferenceStatus(categoryIds: string[], accountIds: string[]) {
    const sql = getPostgres();
    const categories = categoryIds.length ? await sql<{ id: string; active: boolean }[]>`SELECT id, active FROM category WHERE id IN ${sql(categoryIds)}` : [];
    const accounts = accountIds.length ? await sql<{ id: string; active: boolean }[]>`SELECT id, active FROM account WHERE id IN ${sql(accountIds)}` : [];
    return {
      categories: new Map(categories.map((row) => [row.id, row.active])),
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
          INSERT INTO category_template_entry (id, template_id, category_id, account_id, expected_amount, active)
          VALUES (${randomUUID()}, ${id}, ${entry.categoryId}, ${entry.accountId}, ${entry.expectedAmount}, ${entry.active})
        `;
      }
    });
    return (await this.findById(id))!;
  }

  // Atualiza o conteúdo de uma versão sem apagar linhas: as entradas enviadas são inseridas/atualizadas
  // e as que deixaram de constar ficam active = FALSE (histórico preservado).
  async replaceEntries(id: string, entries: CategoryTemplateEntry[]): Promise<CategoryTemplateView | null> {
    const sql = getPostgres();
    await sql.begin(async (transaction) => {
      for (const entry of entries) {
        await transaction`
          INSERT INTO category_template_entry (id, template_id, category_id, account_id, expected_amount, active)
          VALUES (${randomUUID()}, ${id}, ${entry.categoryId}, ${entry.accountId}, ${entry.expectedAmount}, ${entry.active})
          ON CONFLICT (template_id, category_id)
          DO UPDATE SET account_id = EXCLUDED.account_id, expected_amount = EXCLUDED.expected_amount, active = EXCLUDED.active
        `;
      }
      const categoryIds = entries.map((entry) => entry.categoryId);
      if (categoryIds.length) {
        await transaction`UPDATE category_template_entry SET active = FALSE WHERE template_id = ${id} AND active = TRUE AND category_id <> ALL(${categoryIds}::uuid[])`;
      } else {
        await transaction`UPDATE category_template_entry SET active = FALSE WHERE template_id = ${id} AND active = TRUE`;
      }
    });
    return this.findById(id);
  }
}

export const categoryTemplateRepository = new CategoryTemplateRepository();
