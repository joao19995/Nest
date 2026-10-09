import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { GoalTemplate, GoalTemplateEntry } from "@/features/goals/domain/goal-template";

type TemplateRow = { id: string; valid_from: string; annual_total: number | string };

// As colunas priority e deadline_month continuam na base de dados por
// compatibilidade historica, mas ja nao fazem parte da configuracao: a
// alocacao usa apenas goalId + percentage. As escritas usam valores neutros.
type EntryRow = { template_id: string; goal_id: string; percentage: number | string };

function toTemplate(row: TemplateRow, entries: EntryRow[]): GoalTemplate {
  return {
    id: row.id,
    validFrom: row.valid_from,
    annualTotal: Number(row.annual_total),
    entries: entries
      .filter((entry) => entry.template_id === row.id)
      .map((entry) => ({ goalId: entry.goal_id, percentage: Number(entry.percentage) })),
  };
}

export class GoalTemplateRepository {
  private async hydrate(templates: TemplateRow[]): Promise<GoalTemplate[]> {
    if (!templates.length) return [];
    const sql = getPostgres();
    const ids = templates.map((template) => template.id);
    const rows = await sql<EntryRow[]>`SELECT template_id, goal_id, percentage FROM goal_template_entry WHERE template_id IN ${sql(ids)}`;
    return templates.map((template) => toTemplate(template, rows));
  }

  async findAll(): Promise<GoalTemplate[]> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from, annual_total FROM goal_template ORDER BY valid_from`;
    return this.hydrate(templates);
  }

  async findApplicable(month: string): Promise<GoalTemplate | null> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from, annual_total FROM goal_template WHERE valid_from <= ${month} ORDER BY valid_from DESC LIMIT 1`;
    return (await this.hydrate(templates))[0] ?? null;
  }

  async findByValidFrom(validFrom: string): Promise<GoalTemplate | null> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from, annual_total FROM goal_template WHERE valid_from = ${validFrom}`;
    return (await this.hydrate(templates))[0] ?? null;
  }

  async findById(id: string): Promise<GoalTemplate | null> {
    const sql = getPostgres();
    const templates = await sql<TemplateRow[]>`SELECT id, valid_from, annual_total FROM goal_template WHERE id = ${id}`;
    return (await this.hydrate(templates))[0] ?? null;
  }

  async create(validFrom: string, annualTotal: number, entries: GoalTemplateEntry[]): Promise<GoalTemplate> {
    const sql = getPostgres();
    const id = randomUUID();
    await sql.begin(async (transaction) => {
      await transaction`INSERT INTO goal_template (id, valid_from, annual_total) VALUES (${id}, ${validFrom}, ${annualTotal})`;
      for (const entry of entries) {
        await transaction`
          INSERT INTO goal_template_entry (id, template_id, goal_id, percentage, priority, deadline_month)
          VALUES (${randomUUID()}, ${id}, ${entry.goalId}, ${entry.percentage}, 'MEDIUM', NULL)
        `;
      }
    });
    return (await this.findById(id))!;
  }

  // Substitui o conteúdo de uma versão: upsert das enviadas, apaga as removidas.
  // O histórico mensal fechado não é tocado (são tabelas separadas).
  async replace(id: string, annualTotal: number, entries: GoalTemplateEntry[]): Promise<GoalTemplate | null> {
    const sql = getPostgres();
    await sql.begin(async (transaction) => {
      await transaction`UPDATE goal_template SET annual_total = ${annualTotal} WHERE id = ${id}`;
      for (const entry of entries) {
        await transaction`
          INSERT INTO goal_template_entry (id, template_id, goal_id, percentage, priority, deadline_month)
          VALUES (${randomUUID()}, ${id}, ${entry.goalId}, ${entry.percentage}, 'MEDIUM', NULL)
          ON CONFLICT (template_id, goal_id)
          DO UPDATE SET percentage = EXCLUDED.percentage
        `;
      }
      const goalIds = entries.map((entry) => entry.goalId);
      if (goalIds.length) {
        await transaction`DELETE FROM goal_template_entry WHERE template_id = ${id} AND goal_id <> ALL(${goalIds}::uuid[])`;
      } else {
        await transaction`DELETE FROM goal_template_entry WHERE template_id = ${id}`;
      }
    });
    return this.findById(id);
  }
}

export const goalTemplateRepository = new GoalTemplateRepository();
