import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";

export type GoalPlanAllocationView = {
  goalId: string;
  goalName: string;
  planned: number;
  actual: number;
};

export type GoalPlanView = {
  id: string;
  month: string;
  availableAmount: number;
  closed: boolean;
  allocations: GoalPlanAllocationView[];
};

type PlanRow = { id: string; month: string; available_amount: number | string; closed: boolean };

type AllocationRow = {
  goal_id: string;
  goal_name: string;
  planned: number | string;
  actual: number | string;
};

export type UpdateAllocationResult = "ok" | "closed" | "not_found";
export type CloseResult = "ok" | "already_closed" | "not_found";

export class GoalPlanRepository {
  async findByMonth(month: string): Promise<GoalPlanView | null> {
    const sql = getPostgres();
    const plans = await sql<PlanRow[]>`SELECT id, month, available_amount, closed FROM goal_plan_month WHERE month = ${month}`;
    if (!plans.length) return null;
    const plan = plans[0];
    const rows = await sql<AllocationRow[]>`
      SELECT a.goal_id, g.name AS goal_name, a.planned, a.actual
      FROM goal_allocation a
      JOIN goal g ON g.id = a.goal_id
      WHERE a.plan_month_id = ${plan.id}
      ORDER BY g.name
    `;
    return {
      id: plan.id,
      month: plan.month,
      availableAmount: Number(plan.available_amount),
      closed: plan.closed,
      allocations: rows.map((row) => ({
        goalId: row.goal_id,
        goalName: row.goal_name,
        planned: Number(row.planned),
        actual: Number(row.actual),
      })),
    };
  }

  async listClosedPlanned(): Promise<{ month: string; goalId: string; planned: number }[]> {
    const sql = getPostgres();
    const rows = await sql<{ month: string; goal_id: string; planned: number | string }[]>`
      SELECT m.month, a.goal_id, a.planned
      FROM goal_allocation a
      JOIN goal_plan_month m ON m.id = a.plan_month_id
      WHERE m.closed = TRUE
    `;
    return rows.map((row) => ({ month: row.month, goalId: row.goal_id, planned: Number(row.planned) }));
  }

  // Cria o mês com o available calculado (editável enquanto aberto) e linhas a zero para os goals ativos.
  async create(month: string, availableAmount: number): Promise<GoalPlanView | null> {
    const sql = getPostgres();
    if (await this.findByMonth(month)) return null;
    const id = randomUUID();
    await sql.begin(async (transaction) => {
      await transaction`INSERT INTO goal_plan_month (id, month, available_amount, closed) VALUES (${id}, ${month}, ${availableAmount}, FALSE)`;
      const goals = await transaction<{ id: string }[]>`SELECT id FROM goal WHERE active = TRUE`;
      for (const item of goals) {
        await transaction`
          INSERT INTO goal_allocation (id, plan_month_id, goal_id, planned, actual)
          VALUES (${randomUUID()}, ${id}, ${item.id}, 0, 0)
        `;
      }
    });
    return this.findByMonth(month);
  }

  // Garante linha para goals criados depois do mês (só em meses abertos).
  async ensureAllocations(planId: string): Promise<void> {
    const sql = getPostgres();
    await sql`
      INSERT INTO goal_allocation (id, plan_month_id, goal_id, planned, actual)
      SELECT gen_random_uuid(), ${planId}, g.id, 0, 0
      FROM goal g
      JOIN goal_plan_month m ON m.id = ${planId} AND m.closed = FALSE
      LEFT JOIN goal_allocation a ON a.plan_month_id = ${planId} AND a.goal_id = g.id
      WHERE g.active = TRUE AND a.id IS NULL
    `;
  }

  // Recalcula o disponível de um mês aberto (meses fechados nunca mudam).
  async refreshAvailable(planId: string, availableAmount: number): Promise<UpdateAllocationResult> {
    const sql = getPostgres();
    const updated = await sql<{ id: string }[]>`
      UPDATE goal_plan_month SET available_amount = ${availableAmount}
      WHERE id = ${planId} AND closed = FALSE
      RETURNING id
    `;
    if (updated.length) return "ok";
    const [plan] = await sql<{ closed: boolean }[]>`SELECT closed FROM goal_plan_month WHERE id = ${planId}`;
    if (!plan) return "not_found";
    if (plan.closed) return "closed";
    return "not_found";
  }

  async updateAllocation(planId: string, goalId: string, input: { planned?: number; actual?: number }): Promise<UpdateAllocationResult> {    const sql = getPostgres();
    const { planned, actual } = input;
    if (planned === undefined && actual === undefined) return "ok";
    // Condição closed = FALSE no JOIN impede qualquer escrita em mês fechado.
    if (planned !== undefined && actual !== undefined) {
      const updated = await sql<{ id: string }[]>`
        UPDATE goal_allocation a SET planned = ${planned}, actual = ${actual}
        FROM goal_plan_month m
        WHERE a.plan_month_id = ${planId} AND a.goal_id = ${goalId} AND m.id = a.plan_month_id AND m.closed = FALSE
        RETURNING a.id
      `;
      if (updated.length) return "ok";
    } else if (planned !== undefined) {
      const updated = await sql<{ id: string }[]>`
        UPDATE goal_allocation a SET planned = ${planned}
        FROM goal_plan_month m
        WHERE a.plan_month_id = ${planId} AND a.goal_id = ${goalId} AND m.id = a.plan_month_id AND m.closed = FALSE
        RETURNING a.id
      `;
      if (updated.length) return "ok";
    } else {
      const value = actual as number;
      const updated = await sql<{ id: string }[]>`
        UPDATE goal_allocation a SET actual = ${value}
        FROM goal_plan_month m
        WHERE a.plan_month_id = ${planId} AND a.goal_id = ${goalId} AND m.id = a.plan_month_id AND m.closed = FALSE
        RETURNING a.id
      `;
      if (updated.length) return "ok";
    }
    const [plan] = await sql<{ closed: boolean }[]>`SELECT closed FROM goal_plan_month WHERE id = ${planId}`;
    if (!plan) return "not_found";
    if (plan.closed) return "closed";
    return "not_found";
  }

  async close(planId: string): Promise<CloseResult> {
    const sql = getPostgres();
    const closed = await sql<{ id: string }[]>`UPDATE goal_plan_month SET closed = TRUE WHERE id = ${planId} AND closed = FALSE RETURNING id`;
    if (closed.length) return "ok";
    const [plan] = await sql<{ closed: boolean }[]>`SELECT closed FROM goal_plan_month WHERE id = ${planId}`;
    if (!plan) return "not_found";
    return "already_closed";
  }
}

export const goalPlanRepository = new GoalPlanRepository();
