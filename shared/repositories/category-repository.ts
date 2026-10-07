import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Category } from "@/features/monthly-plan/domain/types";

export class CategoryRepository {
  async findAll(): Promise<Category[]> {
    const sql = getPostgres();
    return sql<Category[]>`SELECT id, name, type, active FROM category ORDER BY name`;
  }

  async findById(id: string): Promise<Category | null> {
    const sql = getPostgres();
    const [category] = await sql<Category[]>`SELECT id, name, type, active FROM category WHERE id = ${id}`;
    return category ?? null;
  }

  async create(input: Omit<Category, "id">): Promise<Category> {
    const sql = getPostgres();
    const id = randomUUID();
    const [category] = await sql<Category[]>`INSERT INTO category (id, name, type, active) VALUES (${id}, ${input.name}, ${input.type}, ${input.active}) RETURNING id, name, type, active`;
    return category;
  }

  async update(id: string, input: Omit<Category, "id">): Promise<Category | null> {
    const sql = getPostgres();
    const [category] = await sql<Category[]>`UPDATE category SET name = ${input.name}, type = ${input.type}, active = ${input.active} WHERE id = ${id} RETURNING id, name, type, active`;
    return category ?? null;
  }

  async deactivate(id: string): Promise<Category | null> {
    const sql = getPostgres();
    const [category] = await sql<Category[]>`UPDATE category SET active = FALSE WHERE id = ${id} RETURNING id, name, type, active`;
    return category ?? null;
  }
}

export const categoryRepository = new CategoryRepository();
