import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { PersonIncome } from "@/features/monthly-plan/domain/types";

type PersonIncomeRow = {
  id: string;
  person_id: string;
  amount: number | string;
  valid_from: string;
};

function toPersonIncome(row: PersonIncomeRow): PersonIncome {
  return {
    id: row.id,
    personId: row.person_id,
    amount: Number(row.amount),
    validFrom: row.valid_from.slice(0, 10),
  };
}

export class PersonIncomeRepository {
  async findAllForPerson(personId: string): Promise<PersonIncome[]> {
    const sql = getPostgres();
    const rows = await sql<PersonIncomeRow[]>`
      SELECT id, person_id, amount, to_char(valid_from, 'YYYY-MM-DD') AS valid_from
      FROM person_income WHERE person_id = ${personId} ORDER BY valid_from, id
    `;
    return rows.map(toPersonIncome);
  }

  async findById(personId: string, id: string): Promise<PersonIncome | null> {
    const sql = getPostgres();
    const [row] = await sql<PersonIncomeRow[]>`
      SELECT id, person_id, amount, to_char(valid_from, 'YYYY-MM-DD') AS valid_from
      FROM person_income WHERE person_id = ${personId} AND id = ${id}
    `;
    return row ? toPersonIncome(row) : null;
  }

  async create(personId: string, input: Pick<PersonIncome, "amount" | "validFrom">): Promise<PersonIncome> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<PersonIncomeRow[]>`
      INSERT INTO person_income (id, person_id, amount, valid_from)
      VALUES (${id}, ${personId}, ${input.amount}, ${input.validFrom}::date)
      RETURNING id, person_id, amount, to_char(valid_from, 'YYYY-MM-DD') AS valid_from
    `;
    return toPersonIncome(row);
  }

  async update(personId: string, id: string, input: Pick<PersonIncome, "amount" | "validFrom">): Promise<PersonIncome | null> {
    const sql = getPostgres();
    const [row] = await sql<PersonIncomeRow[]>`
      UPDATE person_income SET amount = ${input.amount}, valid_from = ${input.validFrom}::date
      WHERE person_id = ${personId} AND id = ${id}
      RETURNING id, person_id, amount, to_char(valid_from, 'YYYY-MM-DD') AS valid_from
    `;
    return row ? toPersonIncome(row) : null;
  }
}

export const personIncomeRepository = new PersonIncomeRepository();
