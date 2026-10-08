import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import { categoryTemplateRepository } from "@/shared/repositories/category-template-repository";
import type { MonthlyPlanEntryView, MonthlyPlanView } from "@/features/monthly-plan/domain/types";

type PlanRow = { id: string; month: string; template_id: string; closed: boolean };

type EntryRow = {
  id: string;
  monthly_plan_id: string;
  category_id: string;
  account_id: string;
  planned: number | string;
  actual: number | string;
  category_name: string;
  category_type: "FIXED" | "VARIABLE";
  account_name: string;
  account_owner_person_id: string | null;
};

function toEntry(row: EntryRow): MonthlyPlanEntryView {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryType: row.category_type,
    accountId: row.account_id,
    accountName: row.account_name,
    accountOwnerPersonId: row.account_owner_person_id,
    planned: Number(row.planned),
    actual: Number(row.actual),
  };
}

export type UpdateActualResult = "ok" | "closed" | "not_found";
export type CloseResult = "ok" | "already_closed" | "not_found";

export class MonthlyPlanRepository {
  private async hydrate(plans: PlanRow[]): Promise<MonthlyPlanView[]> {
    if (!plans.length) return [];
    const sql = getPostgres();
    const ids = plans.map((plan) => plan.id);
    const rows = await sql<EntryRow[]>`
      SELECT e.id, e.monthly_plan_id, e.category_id, e.account_id, e.planned, e.actual,
             c.name AS category_name, c.type AS category_type,
             a.name AS account_name, a.owner_person_id AS account_owner_person_id
      FROM monthly_plan_entry e
      JOIN category c ON c.id = e.category_id
      JOIN account a ON a.id = e.account_id
      WHERE e.monthly_plan_id IN ${sql(ids)}
      ORDER BY c.name
    `;
    return plans.map((plan) => ({
      id: plan.id,
      month: plan.month,
      templateId: plan.template_id,
      closed: plan.closed,
      entries: rows.filter((row) => row.monthly_plan_id === plan.id).map(toEntry),
    }));
  }

  async findByMonth(month: string): Promise<MonthlyPlanView | null> {
    const sql = getPostgres();
    const plans = await sql<PlanRow[]>`SELECT id, month, template_id, closed FROM monthly_plan WHERE month = ${month}`;
    return (await this.hydrate(plans))[0] ?? null;
  }

  async findById(id: string): Promise<MonthlyPlanView | null> {
    const sql = getPostgres();
    const plans = await sql<PlanRow[]>`SELECT id, month, template_id, closed FROM monthly_plan WHERE id = ${id}`;
    return (await this.hydrate(plans))[0] ?? null;
  }

  // Cria o mês copiando os entries ativos do template aplicável (snapshot: planned = expectedAmount, actual = 0).
  // Devolve null se não existir template aplicável ao mês.
  async create(month: string): Promise<MonthlyPlanView | null> {
    const template = await categoryTemplateRepository.findApplicable(month);
    if (!template) return null;

    const sql = getPostgres();
    const id = randomUUID();
    const activeEntries = template.entries.filter((entry) => entry.active);
    await sql.begin(async (transaction) => {
      await transaction`INSERT INTO monthly_plan (id, month, template_id, closed) VALUES (${id}, ${month}, ${template.id}, FALSE)`;
      for (const entry of activeEntries) {
        await transaction`
          INSERT INTO monthly_plan_entry (id, monthly_plan_id, category_id, account_id, planned, actual)
          VALUES (${randomUUID()}, ${id}, ${entry.categoryId}, ${entry.accountId}, ${entry.expectedAmount}, 0)
        `;
      }
    });
    return this.findById(id);
  }

  // A condição closed = FALSE faz parte do UPDATE, por isso um mês fechado nunca é alterado.
  async updateActual(planId: string, entryId: string, actual: number): Promise<UpdateActualResult> {
    const sql = getPostgres();
    const updated = await sql<{ id: string }[]>`
      UPDATE monthly_plan_entry e SET actual = ${actual}
      FROM monthly_plan p
      WHERE e.id = ${entryId} AND e.monthly_plan_id = ${planId} AND p.id = e.monthly_plan_id AND p.closed = FALSE
      RETURNING e.id
    `;
    if (updated.length) return "ok";

    const [plan] = await sql<{ closed: boolean }[]>`SELECT closed FROM monthly_plan WHERE id = ${planId}`;
    if (!plan) return "not_found";
    if (plan.closed) return "closed";
    return "not_found";
  }

  async close(planId: string): Promise<CloseResult> {
    const sql = getPostgres();
    const closed = await sql<{ id: string }[]>`UPDATE monthly_plan SET closed = TRUE WHERE id = ${planId} AND closed = FALSE RETURNING id`;
    if (closed.length) return "ok";

    const [plan] = await sql<{ closed: boolean }[]>`SELECT closed FROM monthly_plan WHERE id = ${planId}`;
    if (!plan) return "not_found";
    return "already_closed";
  }

  async hasClosedPlanForTemplate(templateId: string): Promise<boolean> {
    const sql = getPostgres();
    const [row] = await sql<{ used: boolean }[]>`SELECT EXISTS (SELECT 1 FROM monthly_plan WHERE template_id = ${templateId} AND closed = TRUE) AS used`;
    return row.used;
  }
}

export const monthlyPlanRepository = new MonthlyPlanRepository();
