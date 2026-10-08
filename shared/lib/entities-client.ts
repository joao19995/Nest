import type { Account, Category, Person, PersonIncome } from "@/features/monthly-plan/domain/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : "Pedido falhou.";
    throw new Error(message || "Pedido falhou.");
  }
  return body as T;
}

export const entitiesClient = {
  getPeople: () => request<Person[]>("/api/people", { cache: "no-store" }),
  getPerson: (id: string) => request<Person>(`/api/people/${id}`, { cache: "no-store" }),
  createPerson: (person: Omit<Person, "id">) => request<Person>("/api/people", { method: "POST", body: JSON.stringify(person) }),
  updatePerson: (id: string, person: Omit<Person, "id">) => request<Person>(`/api/people/${id}`, { method: "PUT", body: JSON.stringify(person) }),
  getPersonIncomes: (personId: string) => request<PersonIncome[]>(`/api/people/${personId}/income`, { cache: "no-store" }),
  createPersonIncome: (personId: string, income: Pick<PersonIncome, "amount" | "validFrom">) => request<PersonIncome>(`/api/people/${personId}/income`, { method: "POST", body: JSON.stringify(income) }),
  updatePersonIncome: (personId: string, incomeId: string, income: Pick<PersonIncome, "amount" | "validFrom">) => request<PersonIncome>(`/api/people/${personId}/income/${incomeId}`, { method: "PUT", body: JSON.stringify(income) }),

  getAccounts: () => request<Account[]>("/api/accounts", { cache: "no-store" }),
  createAccount: (name: string, ownerPersonId: string | null) => request<Account>("/api/accounts", { method: "POST", body: JSON.stringify({ name, ownerPersonId }) }),
  updateAccount: (id: string, name: string, ownerPersonId: string | null) => request<Account>(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify({ name, ownerPersonId }) }),
  deleteAccount: (id: string) => request<{ id: string }>(`/api/accounts/${id}`, { method: "DELETE" }),

  getCategories: () => request<Category[]>("/api/categories", { cache: "no-store" }),
  createCategory: (name: string, type: Category["type"]) => request<Category>("/api/categories", { method: "POST", body: JSON.stringify({ name, type }) }),
  updateCategory: (id: string, name: string, type: Category["type"], active: boolean) => request<Category>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ name, type, active }) }),
  deactivateCategory: (id: string) => request<Category>(`/api/categories/${id}`, { method: "DELETE" }),
};
