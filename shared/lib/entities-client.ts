import type { Account, Category, CategoryTemplate, CategoryTemplateEntry, CategoryTemplateView, MonthlyPlanView, Person, PersonIncome } from "@/features/monthly-plan/domain/types";
import type { Goal } from "@/features/goals/domain/types";
import type { GoalTemplate, GoalTemplateEntry } from "@/features/goals/domain/goal-template";
import type { MonthFunding, YearFunding } from "@/shared/lib/goal-funding";
import type { GoalPlanView } from "@/shared/repositories/goal-plan-repository";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : "Pedido falhou.";
    throw new Error(message || "Pedido falhou.");
  }
  return body as T;
}

// Como request(), mas devolve null quando o recurso não existe (404), sem lançar erro.
async function requestOrNull<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (response.status === 404) return null;
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : "Pedido falhou.";
    throw new Error(message || "Pedido falhou.");
  }
  return body as T;
}

export const entitiesClient = {
  getMonthlyPlan: (month: string) => requestOrNull<MonthlyPlanView>(`/api/months?month=${encodeURIComponent(month)}`, { cache: "no-store" }),
  createMonthlyPlan: (month: string) => request<MonthlyPlanView>("/api/months", { method: "POST", body: JSON.stringify({ month }) }),
  updateMonthlyPlanActual: (planId: string, entryId: string, actual: number) => request<MonthlyPlanView>(`/api/months/${planId}/entries/${entryId}`, { method: "PATCH", body: JSON.stringify({ actual }) }),
  closeMonthlyPlan: (planId: string) => request<MonthlyPlanView>(`/api/months/${planId}/close`, { method: "POST" }),

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

  getCategoryTemplates: () => request<CategoryTemplateView[]>("/api/category-templates", { cache: "no-store" }),
  getApplicableCategoryTemplate: (month: string) => request<CategoryTemplateView | null>(`/api/category-templates?applicableTo=${month}`, { cache: "no-store" }),
  createCategoryTemplate: (input: { validFrom: string; entries: CategoryTemplateEntry[] }) => request<CategoryTemplateView>("/api/category-templates", { method: "POST", body: JSON.stringify(input) }),
  updateCategoryTemplate: (id: string, entries: CategoryTemplateEntry[]) => request<CategoryTemplateView>(`/api/category-templates/${id}`, { method: "PUT", body: JSON.stringify({ entries }) }),

  getCategories: () => request<Category[]>("/api/categories", { cache: "no-store" }),
  createCategory: (name: string, type: Category["type"]) => request<Category>("/api/categories", { method: "POST", body: JSON.stringify({ name, type }) }),
  updateCategory: (id: string, name: string, type: Category["type"], active: boolean) => request<Category>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ name, type, active }) }),
  deactivateCategory: (id: string) => request<Category>(`/api/categories/${id}`, { method: "DELETE" }),

  getGoals: () => request<Goal[]>("/api/goals", { cache: "no-store" }),
  createGoal: (input: { name: string }) =>
    request<Goal>("/api/goals", { method: "POST", body: JSON.stringify(input) }),
  renameGoal: (id: string, name: string) => request<Goal>(`/api/goals/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteGoal: (id: string) => request<{ id: string }>(`/api/goals/${id}`, { method: "DELETE" }),

  getGoalPlan: (month: string) => requestOrNull<GoalPlanView>(`/api/goal-plan?month=${encodeURIComponent(month)}`, { cache: "no-store" }),
  getClosedGoalPlanned: () => request<{ month: string; goalId: string; planned: number }[]>("/api/goal-plan/closed", { cache: "no-store" }),
  getGoalsFundingByYear: (year: number) => request<YearFunding>(`/api/goals-funding?year=${year}`, { cache: "no-store" }),
  getGoalsFundingByMonth: (month: string) => request<MonthFunding>(`/api/goals-funding?month=${encodeURIComponent(month)}`, { cache: "no-store" }),
  createGoalPlan: (month: string) => request<GoalPlanView>("/api/goal-plan", { method: "POST", body: JSON.stringify({ month }) }),
  refreshGoalPlan: (planId: string) => request<GoalPlanView>(`/api/goal-plan/${planId}/refresh`, { method: "POST" }),
  updateGoalAllocation: (planId: string, goalId: string, input: { planned?: number; actual?: number }) =>
    request<GoalPlanView>(`/api/goal-plan/${planId}/allocations/${goalId}`, { method: "PATCH", body: JSON.stringify(input) }),
  closeGoalPlan: (planId: string) => request<GoalPlanView>(`/api/goal-plan/${planId}/close`, { method: "POST" }),

  getGoalTemplates: () => request<GoalTemplate[]>("/api/goal-templates", { cache: "no-store" }),
  getApplicableGoalTemplate: (month: string) => request<GoalTemplate | null>(`/api/goal-templates?applicableTo=${month}`, { cache: "no-store" }),
  createGoalTemplate: (input: { validFrom: string; annualTotal: number; entries: GoalTemplateEntry[] }) =>
    request<GoalTemplate>("/api/goal-templates", { method: "POST", body: JSON.stringify(input) }),
  updateGoalTemplate: (id: string, input: { annualTotal: number; entries: GoalTemplateEntry[] }) =>
    request<GoalTemplate>(`/api/goal-templates/${id}`, { method: "PUT", body: JSON.stringify(input) }),
};
