import { randomUUID } from "node:crypto";
import { getPostgres } from "@/shared/lib/postgres";
import type { Account } from "@/features/monthly-plan/domain/types";

type AccountRow = { id: string; name: string; owner_person_id: string | null; active: boolean };

function toAccount(row: AccountRow): Account {
  return { id: row.id, name: row.name, ownerPersonId: row.owner_person_id, active: row.active };
}

export class AccountRepository {
  async findAll(): Promise<Account[]> {
    const sql = getPostgres();
    const rows = await sql<AccountRow[]>`SELECT id, name, owner_person_id, active FROM account WHERE active = TRUE ORDER BY name`;
    return rows.map(toAccount);
  }

  async findById(id: string): Promise<Account | null> {
    const sql = getPostgres();
    const [row] = await sql<AccountRow[]>`SELECT id, name, owner_person_id, active FROM account WHERE id = ${id} AND active = TRUE`;
    return row ? toAccount(row) : null;
  }

  async create(input: Omit<Account, "id" | "active">): Promise<Account> {
    const sql = getPostgres();
    const id = randomUUID();
    const [row] = await sql<AccountRow[]>`INSERT INTO account (id, name, owner_person_id, active) VALUES (${id}, ${input.name}, ${input.ownerPersonId}, TRUE) RETURNING id, name, owner_person_id, active`;
    return toAccount(row);
  }

  async update(id: string, input: Pick<Account, "name" | "ownerPersonId">): Promise<Account | null> {
    const sql = getPostgres();
    const [row] = await sql<AccountRow[]>`UPDATE account SET name = ${input.name}, owner_person_id = ${input.ownerPersonId} WHERE id = ${id} AND active = TRUE RETURNING id, name, owner_person_id, active`;
    return row ? toAccount(row) : null;
  }

  async deactivate(id: string): Promise<boolean> {
    const sql = getPostgres();
    const rows = await sql<{ id: string }[]>`UPDATE account SET active = FALSE WHERE id = ${id} AND active = TRUE RETURNING id`;
    return rows.length > 0;
  }
}

export const accountRepository = new AccountRepository();
