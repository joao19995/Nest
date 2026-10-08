import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Account } from "@/features/monthly-plan/domain/types";

type AccountRow = { id: string; name: string; owner_person_id: string | null };

function toAccount(row: AccountRow): Account {
  return { id: row.id, name: row.name, ownerPersonId: row.owner_person_id };
}

export class AccountRepository {
  async findAll(): Promise<Account[]> {
    const sql = getPostgres();
    const rows = await sql<AccountRow[]>`SELECT id, name, owner_person_id FROM account ORDER BY name`;
    return rows.map(toAccount);
  }

  async findById(id: string): Promise<Account | null> {
    const sql = getPostgres();
    const [row] = await sql<AccountRow[]>`SELECT id, name, owner_person_id FROM account WHERE id = ${id}`;
    return row ? toAccount(row) : null;
  }

  async create(input: Omit<Account, "id">): Promise<Account> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<AccountRow[]>`INSERT INTO account (id, name, owner_person_id) VALUES (${id}, ${input.name}, ${input.ownerPersonId}) RETURNING id, name, owner_person_id`;
    return toAccount(row);
  }

  async update(id: string, input: Omit<Account, "id">): Promise<Account | null> {
    const sql = getPostgres();
    const [row] = await sql<AccountRow[]>`UPDATE account SET name = ${input.name}, owner_person_id = ${input.ownerPersonId} WHERE id = ${id} RETURNING id, name, owner_person_id`;
    return row ? toAccount(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const sql = getPostgres();
    const rows = await sql<{ id: string }[]>`DELETE FROM account WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
}

export const accountRepository = new AccountRepository();
