import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Person } from "@/features/monthly-plan/domain/types";

export class PersonRepository {
  async findAll(): Promise<Person[]> {
    const sql = getPostgres();
    return sql<Person[]>`SELECT id, name FROM person ORDER BY name`;
  }

  async findById(id: string): Promise<Person | null> {
    const sql = getPostgres();
    const [person] = await sql<Person[]>`SELECT id, name FROM person WHERE id = ${id}`;
    return person ?? null;
  }

  async create(input: Pick<Person, "name">): Promise<Person> {
    const sql = getPostgres();
    const id = randomUUID();
    const [person] = await sql<Person[]>`INSERT INTO person (id, name) VALUES (${id}, ${input.name}) RETURNING id, name`;
    return person;
  }

  async update(id: string, input: Pick<Person, "name">): Promise<Person | null> {
    const sql = getPostgres();
    const [person] = await sql<Person[]>`UPDATE person SET name = ${input.name} WHERE id = ${id} RETURNING id, name`;
    return person ?? null;
  }
}

export const personRepository = new PersonRepository();
