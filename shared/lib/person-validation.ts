import type { Person } from "@/features/monthly-plan/domain/types";

export type PersonInput = Omit<Person, "id">;

export function parsePersonInput(value: unknown): PersonInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PersonInput>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100) return null;
  if (typeof input.dailySpendingPercentage !== "number" || !Number.isFinite(input.dailySpendingPercentage)) return null;
  if (typeof input.emergencyFundMonths !== "number" || !Number.isInteger(input.emergencyFundMonths) || input.emergencyFundMonths < 0) return null;
  if (typeof input.individualFixedAmount !== "number" || !Number.isFinite(input.individualFixedAmount) || input.individualFixedAmount < 0) return null;

  return {
    name,
    dailySpendingPercentage: input.dailySpendingPercentage,
    emergencyFundMonths: input.emergencyFundMonths,
    individualFixedAmount: Math.round(input.individualFixedAmount * 100) / 100,
  };
}

export function parsePersonIncomeInput(value: unknown): { amount: number; validFrom: string } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { amount?: unknown; validFrom?: unknown };
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount < 0) return null;
  if (typeof input.validFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom)) return null;
  const parsedDate = new Date(`${input.validFrom}T00:00:00.000Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.validFrom) return null;
  return { amount: input.amount, validFrom: input.validFrom };
}
