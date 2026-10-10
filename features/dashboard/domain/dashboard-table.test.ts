import { describe, expect, it } from "vitest";
import type { MonthlyPlanView } from "@/features/monthly-plan/domain/types";
import { buildDashboardRows, monthsOfYear } from "./dashboard-table";

const CASA = "c472c0d6-4ae0-4835-bf58-34cc9801420a";
const CARRO = "20dd6cf8-9bb6-468b-86ac-bf47d3d96eae";
const CAO = "e4f97dc8-ddb9-41f7-9c8a-187a2c419f51";

function plan(month: string, entries: { categoryId: string; planned: number; actual: number }[]): MonthlyPlanView {
  return {
    id: `plan-${month}`,
    month,
    templateId: "t",
    closed: false,
    entries: entries.map((entry, index) => ({
      id: `e-${month}-${index}`,
      categoryId: entry.categoryId,
      categoryName: entry.categoryId === CASA ? "Casa" : entry.categoryId === CARRO ? "Carro" : "Cão",
      categoryType: "FIXED",
      accountId: "acc",
      accountName: "Conjunta",
      accountOwnerPersonId: null,
      planned: entry.planned,
      actual: entry.actual,
    })),
  };
}

describe("buildDashboardRows", () => {
  it("returns 12 months for the year, empty where there is no plan", () => {
    const rows = buildDashboardRows(2026, [], [CASA]);
    expect(rows).toHaveLength(12);
    expect(rows[0].month).toBe("2026-01");
    expect(rows.every((row) => !row.hasPlan && row.plannedTotal === null && row.deviation === null && row.actualByCategory[CASA] === null)).toBe(true);
  });

  it("shows the actual of each chosen category and the monthly deviation in euros and percent", () => {
    const plans = [plan("2026-03", [
      { categoryId: CASA, planned: 1000, actual: 1010 },
      { categoryId: CARRO, planned: 100, actual: 90 },
      { categoryId: CAO, planned: 80, actual: 80 },
    ])];
    const march = buildDashboardRows(2026, plans, [CASA, CARRO])[2];
    expect(march.hasPlan).toBe(true);
    expect(march.actualByCategory).toEqual({ [CASA]: 1010, [CARRO]: 90 });
    expect(march.plannedTotal).toBe(1180);
    expect(march.actualTotal).toBe(1180);
    expect(march.deviation).toBe(0);
    expect(march.deviationPct).toBeCloseTo(0);
  });

  it("marks a category as missing (null) when the plan has no line for it", () => {
    const plans = [plan("2026-04", [{ categoryId: CASA, planned: 1000, actual: 1000 }])];
    const april = buildDashboardRows(2026, plans, [CASA, CARRO])[3];
    expect(april.actualByCategory[CARRO]).toBeNull();
  });

  it("uses null percent when the planned total is zero, but keeps the euro deviation", () => {
    const plans = [plan("2026-05", [{ categoryId: CASA, planned: 0, actual: 15 }])];
    const may = buildDashboardRows(2026, plans, [CASA])[4];
    expect(may.deviation).toBe(15);
    expect(may.deviationPct).toBeNull();
  });

  it("ignores plans from other years", () => {
    const plans = [plan("2025-03", [{ categoryId: CASA, planned: 1000, actual: 1000 }])];
    expect(buildDashboardRows(2026, plans, [CASA]).every((row) => !row.hasPlan)).toBe(true);
  });

  it("monthsOfYear returns YYYY-MM for each month", () => {
    expect(monthsOfYear(2026)[11]).toBe("2026-12");
  });
});
