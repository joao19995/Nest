import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Person } from "@/features/monthly-plan/domain/types";

type PersonRow = {
  id: string;
  name: string;
  daily_spending_percentage: number | string;
  emergency_fund_months: number;
  individual_fixed_amount: number | string;
};

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    dailySpendingPercentage: Number(row.daily_spending_percentage),
    emergencyFundMonths: row.emergency_fund_months,
    individualFixedAmount: Number(row.individual_fixed_amount ?? 0),
  };
}

export class PersonRepository {
  async findAll(): Promise<Person[]> {
    const sql = getPostgres();
    const rows = await sql<PersonRow[]>`SELECT id, name, daily_spending_percentage, emergency_fund_months, individual_fixed_amount FROM person ORDER BY name`;
    return rows.map(toPerson);
  }

  async findById(id: string): Promise<Person | null> {
    const sql = getPostgres();
    const [row] = await sql<PersonRow[]>`SELECT id, name, daily_spending_percentage, emergency_fund_months, individual_fixed_amount FROM person WHERE id = ${id}`;
    return row ? toPerson(row) : null;
  }

  async create(input: Omit<Person, "id">): Promise<Person> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<PersonRow[]>`
      INSERT INTO person (id, name, daily_spending_percentage, emergency_fund_months, individual_fixed_amount)
      VALUES (${id}, ${input.name}, ${input.dailySpendingPercentage}, ${input.emergencyFundMonths}, ${input.individualFixedAmount ?? 0})
      RETURNING id, name, daily_spending_percentage, emergency_fund_months, individual_fixed_amount
    `;
    return toPerson(row);
  }

  async update(id: string, input: Omit<Person, "id">): Promise<Person | null> {
    const sql = getPostgres();
    const [row] = await sql<PersonRow[]>`
      UPDATE person SET name = ${input.name}, daily_spending_percentage = ${input.dailySpendingPercentage}, emergency_fund_months = ${input.emergencyFundMonths}, individual_fixed_amount = ${input.individualFixedAmount ?? 0}
      WHERE id = ${id}
      RETURNING id, name, daily_spending_percentage, emergency_fund_months, individual_fixed_amount
    `;
    return row ? toPerson(row) : null;
  }
}

export const personRepository = new PersonRepository();
