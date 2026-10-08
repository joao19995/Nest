import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Person } from "@/features/monthly-plan/domain/types";

type PersonRow = {
  id: string;
  name: string;
  daily_spending_percentage: number | string;
  contribution_minimum: number | string;
  emergency_fund_months: number;
};

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    dailySpendingPercentage: Number(row.daily_spending_percentage),
    contributionMinimum: Number(row.contribution_minimum),
    emergencyFundMonths: row.emergency_fund_months,
  };
}

export class PersonRepository {
  async findAll(): Promise<Person[]> {
    const sql = getPostgres();
    const rows = await sql<PersonRow[]>`SELECT id, name, daily_spending_percentage, contribution_minimum, emergency_fund_months FROM person ORDER BY name`;
    return rows.map(toPerson);
  }

  async findById(id: string): Promise<Person | null> {
    const sql = getPostgres();
    const [row] = await sql<PersonRow[]>`SELECT id, name, daily_spending_percentage, contribution_minimum, emergency_fund_months FROM person WHERE id = ${id}`;
    return row ? toPerson(row) : null;
  }

  async create(input: Omit<Person, "id">): Promise<Person> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<PersonRow[]>`
      INSERT INTO person (id, name, daily_spending_percentage, contribution_minimum, emergency_fund_months)
      VALUES (${id}, ${input.name}, ${input.dailySpendingPercentage}, ${input.contributionMinimum}, ${input.emergencyFundMonths})
      RETURNING id, name, daily_spending_percentage, contribution_minimum, emergency_fund_months
    `;
    return toPerson(row);
  }

  async update(id: string, input: Omit<Person, "id">): Promise<Person | null> {
    const sql = getPostgres();
    const [row] = await sql<PersonRow[]>`
      UPDATE person SET name = ${input.name}, daily_spending_percentage = ${input.dailySpendingPercentage}, contribution_minimum = ${input.contributionMinimum}, emergency_fund_months = ${input.emergencyFundMonths}
      WHERE id = ${id}
      RETURNING id, name, daily_spending_percentage, contribution_minimum, emergency_fund_months
    `;
    return row ? toPerson(row) : null;
  }
}

export const personRepository = new PersonRepository();
