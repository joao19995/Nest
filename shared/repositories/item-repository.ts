import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Item } from "@/features/monthly-plan/domain/types";

export type ItemView = Item & { categoryName: string };

type ItemRow = {
  id: string;
  name: string;
  category_id: string;
  active: boolean;
  category_name: string;
};

function toItem(row: ItemRow): ItemView {
  return { id: row.id, name: row.name, categoryId: row.category_id, active: row.active, categoryName: row.category_name };
}

export class ItemRepository {
  async findAll(): Promise<ItemView[]> {
    const sql = getPostgres();
    const rows = await sql<ItemRow[]>`
      SELECT i.id, i.name, i.category_id, i.active, c.name AS category_name
      FROM item i JOIN category c ON c.id = i.category_id
      ORDER BY c.name, i.name
    `;
    return rows.map(toItem);
  }

  async findById(id: string): Promise<ItemView | null> {
    const sql = getPostgres();
    const [row] = await sql<ItemRow[]>`
      SELECT i.id, i.name, i.category_id, i.active, c.name AS category_name
      FROM item i JOIN category c ON c.id = i.category_id
      WHERE i.id = ${id}
    `;
    return row ? toItem(row) : null;
  }

  // Mapa id -> { active, categoryId } para validar referências de templates.
  async findStatus(ids: string[]): Promise<Map<string, { active: boolean; categoryId: string }>> {
    const sql = getPostgres();
    if (!ids.length) return new Map();
    const rows = await sql<{ id: string; active: boolean; category_id: string }[]>`SELECT id, active, category_id FROM item WHERE id IN ${sql(ids)}`;
    return new Map(rows.map((row) => [row.id, { active: row.active, categoryId: row.category_id }]));
  }

  async create(categoryId: string, name: string): Promise<ItemView> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<ItemRow[]>`
      INSERT INTO item (id, name, category_id, active)
      VALUES (${id}, ${name}, ${categoryId}, TRUE)
      RETURNING id, name, category_id, active, (SELECT name FROM category WHERE id = ${categoryId}) AS category_name
    `;
    return toItem(row);
  }

  async update(id: string, input: { name: string; categoryId: string; active: boolean }): Promise<ItemView | null> {
    const sql = getPostgres();
    const [row] = await sql<ItemRow[]>`
      UPDATE item SET name = ${input.name}, category_id = ${input.categoryId}, active = ${input.active}
      WHERE id = ${id}
      RETURNING id, name, category_id, active, (SELECT name FROM category WHERE id = ${input.categoryId}) AS category_name
    `;
    return row ? toItem(row) : null;
  }

  async deactivate(id: string): Promise<ItemView | null> {
    const sql = getPostgres();
    const [row] = await sql<ItemRow[]>`
      UPDATE item SET active = FALSE WHERE id = ${id}
      RETURNING id, name, category_id, active, (SELECT name FROM category WHERE id = item.category_id) AS category_name
    `;
    return row ? toItem(row) : null;
  }
}

export const itemRepository = new ItemRepository();
