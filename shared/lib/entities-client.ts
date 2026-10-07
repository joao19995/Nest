import type { Account, Category, Person } from "@/features/monthly-plan/domain/types";

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
  createPerson: (name: string) => request<Person>("/api/people", { method: "POST", body: JSON.stringify({ name }) }),
  updatePerson: (id: string, name: string) => request<Person>(`/api/people/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),

  getAccounts: () => request<Account[]>("/api/accounts", { cache: "no-store" }),
  createAccount: (name: string, ownerPersonId: string | null) => request<Account>("/api/accounts", { method: "POST", body: JSON.stringify({ name, ownerPersonId }) }),
  updateAccount: (id: string, name: string, ownerPersonId: string | null) => request<Account>(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify({ name, ownerPersonId }) }),

  getCategories: () => request<Category[]>("/api/categories", { cache: "no-store" }),
  createCategory: (name: string, type: Category["type"]) => request<Category>("/api/categories", { method: "POST", body: JSON.stringify({ name, type }) }),
  updateCategory: (id: string, name: string, type: Category["type"], active: boolean) => request<Category>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ name, type, active }) }),
  deactivateCategory: (id: string) => request<Category>(`/api/categories/${id}`, { method: "DELETE" }),
};
