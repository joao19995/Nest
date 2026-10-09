import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Goal, GoalPriority, GoalTimeline, GoalYearReview } from "@/features/goals/domain/types";

type GoalRow = {
  id: string;
  name: string;
  target_amount: number | string;
  priority: GoalPriority;
  timeline: GoalTimeline;
  realism: string;
  notes: string;
};

type ReviewRow = {
  goal_id: string;
  year: number;
  happiness: number | null;
  reflection: string;
};

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    priority: row.priority,
    timeline: row.timeline,
    realism: row.realism,
    notes: row.notes,
  };
}

function toReview(row: ReviewRow): GoalYearReview {
  return {
    goalId: row.goal_id,
    year: Number(row.year),
    happiness: row.happiness === null ? null : Number(row.happiness),
    reflection: row.reflection,
  };
}

export type GoalDetails = {
  name: string;
  targetAmount: number;
  priority: GoalPriority;
  timeline: GoalTimeline;
  realism: string;
  notes: string;
};

export class GoalRepository {
  async list(): Promise<Goal[]> {
    const sql = getPostgres();
    const rows = await sql<GoalRow[]>`SELECT id, name, target_amount, priority, timeline, realism, notes FROM goal WHERE active = TRUE ORDER BY name`;
    return rows.map(toGoal);
  }

  async findById(id: string): Promise<Goal | null> {
    const sql = getPostgres();
    const [row] = await sql<GoalRow[]>`SELECT id, name, target_amount, priority, timeline, realism, notes FROM goal WHERE id = ${id} AND active = TRUE`;
    return row ? toGoal(row) : null;
  }

  async create(name: string, details?: Partial<Omit<GoalDetails, "name">>): Promise<Goal> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<GoalRow[]>`
      INSERT INTO goal (id, name, target_amount, priority, timeline, realism, notes, active)
      VALUES (${id}, ${name}, ${details?.targetAmount ?? 0}, ${details?.priority ?? "NICE_TO_HAVE"}, ${details?.timeline ?? "ANUAL"}, ${details?.realism ?? "OK"}, ${details?.notes ?? ""}, TRUE)
      RETURNING id, name, target_amount, priority, timeline, realism, notes
    `;
    return toGoal(row);
  }

  async update(id: string, details: GoalDetails): Promise<Goal | null> {
    const sql = getPostgres();
    const [row] = await sql<GoalRow[]>`
      UPDATE goal
      SET name = ${details.name}, target_amount = ${details.targetAmount}, priority = ${details.priority},
        timeline = ${details.timeline}, realism = ${details.realism}, notes = ${details.notes}
      WHERE id = ${id} AND active = TRUE
      RETURNING id, name, target_amount, priority, timeline, realism, notes
    `;
    return row ? toGoal(row) : null;
  }

  // Apagar = desativar (histórico de meses fechados preservado).
  async archive(id: string): Promise<boolean> {
    const sql = getPostgres();
    const rows = await sql<{ id: string }[]>`UPDATE goal SET active = FALSE WHERE id = ${id} AND active = TRUE RETURNING id`;
    return rows.length > 0;
  }

  async listReviewsByYear(year: number): Promise<GoalYearReview[]> {
    const sql = getPostgres();
    const rows = await sql<ReviewRow[]>`SELECT goal_id, year, happiness, reflection FROM goal_year_review WHERE year = ${year}`;
    return rows.map(toReview);
  }

  async upsertReview(input: { goalId: string; year: number; happiness: number | null; reflection: string }): Promise<GoalYearReview> {
    const sql = getPostgres();
    const [row] = await sql<ReviewRow[]>`
      INSERT INTO goal_year_review (goal_id, year, happiness, reflection)
      VALUES (${input.goalId}, ${input.year}, ${input.happiness}, ${input.reflection})
      ON CONFLICT (goal_id, year)
      DO UPDATE SET happiness = EXCLUDED.happiness, reflection = EXCLUDED.reflection
      RETURNING goal_id, year, happiness, reflection
    `;
    return toReview(row);
  }
}

export const goalRepository = new GoalRepository();
