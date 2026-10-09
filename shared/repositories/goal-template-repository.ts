import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import { syncMonthAllocations } from "@/shared/repositories/goal-plan-repository";
import type { GoalTemplate, GoalTemplateEntry } from "@/features/goals/domain/goal-template";

export class GoalTemplateVersionError extends Error {
  readonly code: "duplicate_valid_from" | "version_in_use" | "not_found";
  constructor(code: GoalTemplateVersionError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

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
    try {
      await sql.begin(async (transaction) => {
        await transaction`INSERT INTO goal_template (id, valid_from, annual_total) VALUES (${id}, ${validFrom}, ${annualTotal})`;
        for (const entry of entries) {
          await transaction`
            INSERT INTO goal_template_entry (id, template_id, goal_id, percentage, priority, deadline_month)
            VALUES (${randomUUID()}, ${id}, ${entry.goalId}, ${entry.percentage}, 'MEDIUM', NULL)
          `;
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new GoalTemplateVersionError(
          "duplicate_valid_from",
          `Já existe um template a partir de ${validFrom}. Escolhe outro mês ou edita essa versão futura se ainda não foi usada.`,
        );
      }
      throw error;
    }
    return (await this.findById(id))!;
  }

  /**
   * Meses com plano guardado governados por uma versão: meses >= validFrom
   * da versão e anteriores à validFrom seguinte. Só esses meses podem ser
   * afetados por uma edição — por isso uma versão com meses governados é
   * imutável (tem de se criar uma nova versão em vez de reescrever).
   */
  async findGovernedMonths(id: string): Promise<{ month: string; closed: boolean }[]> {
    const sql = getPostgres();
    const versions = await sql<{ id: string; valid_from: string }[]>`SELECT id, valid_from FROM goal_template ORDER BY valid_from`;
    const index = versions.findIndex((version) => version.id === id);
    if (index < 0) return [];
    const from = versions[index].valid_from;
    const next = versions[index + 1]?.valid_from ?? null;
    if (next) {
      return sql<{ month: string; closed: boolean }[]>`
        SELECT month, closed FROM goal_plan_month
        WHERE month >= ${from} AND month < ${next}
        ORDER BY month
      `;
    }
    return sql<{ month: string; closed: boolean }[]>`
      SELECT month, closed FROM goal_plan_month
      WHERE month >= ${from}
      ORDER BY month
    `;
  }

  /**
   * Cria uma nova versão E aplica o pré-cálculo do ano numa ÚNICA transação:
   * ou ambos acontecem ou nenhum acontece (nunca fica uma versão gravada
   * com os meses por recalcular por um erro a meio). A unicidade de
   * valid_from é garantida pela constraint UNIQUE — pedidos concorrentes
   * para o mesmo mês resultam num só vencedor e no erro
   * duplicate_valid_from para o outro.
   */
  async createWithYearSeeds(
    validFrom: string,
    annualTotal: number,
    entries: GoalTemplateEntry[],
    year: number,
    seeds: { month: string; availableAmount: number; allocations: { goalId: string; planned: number }[] }[],
  ): Promise<GoalTemplate> {
    const sql = getPostgres();
    const id = randomUUID();
    try {
      await sql.begin(async (transaction) => {
        await transaction`INSERT INTO goal_template (id, valid_from, annual_total) VALUES (${id}, ${validFrom}, ${annualTotal})`;
        for (const entry of entries) {
          await transaction`
            INSERT INTO goal_template_entry (id, template_id, goal_id, percentage, priority, deadline_month)
            VALUES (${randomUUID()}, ${id}, ${entry.goalId}, ${entry.percentage}, 'MEDIUM', NULL)
          `;
        }
        for (const seed of seeds) {
          if (!seed.month.startsWith(`${year}-`)) continue;
          await transaction`
            INSERT INTO goal_plan_month (id, month, available_amount, closed)
            VALUES (${randomUUID()}, ${seed.month}, ${seed.availableAmount}, FALSE)
            ON CONFLICT (month) DO NOTHING
          `;
          const [plan] = await transaction<{ id: string; closed: boolean }[]>`
            SELECT id, closed FROM goal_plan_month WHERE month = ${seed.month} FOR UPDATE
          `;
          if (!plan || plan.closed) continue;
          await transaction`UPDATE goal_plan_month SET available_amount = ${seed.availableAmount} WHERE id = ${plan.id}`;
          await syncMonthAllocations(transaction, plan.id, seed.availableAmount, seed.allocations);
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new GoalTemplateVersionError(
          "duplicate_valid_from",
          `Já existe um template a partir de ${validFrom}. Escolhe outro mês ou edita essa versão futura se ainda não foi usada.`,
        );
      }
      throw error;
    }
    return (await this.findById(id))!;
  }

  // Substitui o conteúdo de uma versão NÃO USADA (sem nenhum mês governado:
  // upsert das enviadas, apaga as removidas). A verificação de uso acontece
  // DENTRO da transação, com a linha da versão bloqueada (FOR UPDATE), por
  // isso edições concorrentes da mesma versão serializam e uma versão que
  // entretanto passe a governar meses é rejeitada em vez de reescrever
  // histórico. Versões com meses governados lançam version_in_use: o
  // chamador deve responder 409 a pedir uma nova versão.
  async replaceIfUnused(id: string, annualTotal: number, entries: GoalTemplateEntry[]): Promise<GoalTemplate | null> {
    return this.replaceUnusedWithYearSeeds(id, annualTotal, entries, 0, []);
  }

  /**
   * Edita uma versão NÃO USADA e aplica o pré-cálculo do ano na MESMA
   * transação (mesma atomicidade da criação). Versões com meses governados
   * lançam version_in_use.
   */
  async replaceUnusedWithYearSeeds(
    id: string,
    annualTotal: number,
    entries: GoalTemplateEntry[],
    year: number,
    seeds: { month: string; availableAmount: number; allocations: { goalId: string; planned: number }[] }[],
  ): Promise<GoalTemplate | null> {
    const sql = getPostgres();
    const result = await sql.begin(async (transaction) => {
      const versions = await transaction<{ id: string; valid_from: string }[]>`
        SELECT id, valid_from FROM goal_template WHERE id = ${id} FOR UPDATE
      `;
      if (!versions.length) return "not_found" as const;
      const all = await transaction<{ id: string; valid_from: string }[]>`
        SELECT id, valid_from FROM goal_template ORDER BY valid_from
      `;
      const index = all.findIndex((version) => version.id === id);
      const from = all[index].valid_from;
      const next = all[index + 1]?.valid_from ?? null;
      const governed = next
        ? await transaction<{ month: string }[]>`SELECT month FROM goal_plan_month WHERE month >= ${from} AND month < ${next} LIMIT 1`
        : await transaction<{ month: string }[]>`SELECT month FROM goal_plan_month WHERE month >= ${from} LIMIT 1`;
      if (governed.length) return "in_use" as const;
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
      for (const seed of seeds) {
        if (!seed.month.startsWith(`${year}-`)) continue;
        await transaction`
          INSERT INTO goal_plan_month (id, month, available_amount, closed)
          VALUES (${randomUUID()}, ${seed.month}, ${seed.availableAmount}, FALSE)
          ON CONFLICT (month) DO NOTHING
        `;
        const [plan] = await transaction<{ id: string; closed: boolean }[]>`
          SELECT id, closed FROM goal_plan_month WHERE month = ${seed.month} FOR UPDATE
        `;
        if (!plan || plan.closed) continue;
        await transaction`UPDATE goal_plan_month SET available_amount = ${seed.availableAmount} WHERE id = ${plan.id}`;
        await syncMonthAllocations(transaction, plan.id, seed.availableAmount, seed.allocations);
      }
      return "ok" as const;
    });
    if (result === "not_found") return null;
    if (result === "in_use") {
      throw new GoalTemplateVersionError(
        "version_in_use",
        "Esta versão já é usada por meses planeados e não pode ser alterada. Cria uma nova versão com efeito a partir do mês pretendido.",
      );
    }
    return this.findById(id);
  }
}

export const goalTemplateRepository = new GoalTemplateRepository();
