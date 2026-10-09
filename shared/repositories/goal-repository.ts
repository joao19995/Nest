import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Goal } from "@/features/goals/domain/types";

type GoalRow = {
  id: string;
  name: string;
};

function toGoal(row: GoalRow): Goal {
  return { id: row.id, name: row.name };
}

export class GoalRepository {
  async list(): Promise<Goal[]> {
    const sql = getPostgres();
    const rows = await sql<GoalRow[]>`SELECT id, name FROM goal WHERE active = TRUE ORDER BY name`;
    return rows.map(toGoal);
  }

  async create(name: string): Promise<Goal> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<GoalRow[]>`
      INSERT INTO goal (id, name, active)
      VALUES (${id}, ${name}, TRUE)
      RETURNING id, name
    `;
    return toGoal(row);
  }

  async rename(id: string, name: string): Promise<Goal | null> {
    const sql = getPostgres();
    const [row] = await sql<GoalRow[]>`
      UPDATE goal SET name = ${name} WHERE id = ${id} AND active = TRUE
      RETURNING id, name
    `;
    return row ? toGoal(row) : null;
  }

  // Apagar = desativar (histórico de meses fechados preservado).
  async archive(id: string): Promise<boolean> {
    const sql = getPostgres();
    const rows = await sql<{ id: string }[]>`UPDATE goal SET active = FALSE WHERE id = ${id} AND active = TRUE RETURNING id`;
    return rows.length > 0;
  }
}

export const goalRepository = new GoalRepository();
