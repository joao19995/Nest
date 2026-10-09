import { describe, expect, it } from "vitest";
import type { MonthlyPlanView } from "@/features/monthly-plan/domain/types";
import { buildDashboardRows, monthsOfYear } from "./dashboard-table";

const LUZ = "11111111-1111-4111-8111-111111111111";
const AGUA = "22222222-2222-4222-8222-222222222222";
const CASA = "c472c0d6-4ae0-4835-bf58-34cc9801420a";

function plan(month: string, entries: { itemId: string; planned: number; actual: number }[]): MonthlyPlanView {
  return {
    id: `plan-${month}`,
    month,
    templateId: "t",
    closed: false,
    entries: entries.map((entry, index) => ({
      id: `e-${month}-${index}`,
      itemId: entry.itemId,
      itemName: entry.itemId === LUZ ? "Luz" : entry.itemId === AGUA ? "Água" : "Renda",
      itemActive: true,
      categoryId: CASA,
      categoryName: "Casa",
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
    const rows = buildDashboardRows(2026, [], [LUZ]);
    expect(rows).toHaveLength(12);
    expect(rows[0].month).toBe("2026-01");
    expect(rows.every((row) => !row.hasPlan && row.plannedTotal === null && row.deviation === null && row.actualByItem[LUZ] === null)).toBe(true);
  });

  it("shows the actual of each chosen item and the monthly deviation in euros and percent", () => {
    const plans = [plan("2026-03", [
      { itemId: LUZ, planned: 60, actual: 72 },
      { itemId: AGUA, planned: 20, actual: 18 },
      { itemId: CASA, planned: 1000, actual: 1000 },
    ])];
    const march = buildDashboardRows(2026, plans, [LUZ, AGUA])[2];
    expect(march.hasPlan).toBe(true);
    expect(march.actualByItem).toEqual({ [LUZ]: 72, [AGUA]: 18 });
    expect(march.plannedTotal).toBe(1080);
    expect(march.actualTotal).toBe(1090);
    expect(march.deviation).toBe(10);
    expect(march.deviationPct).toBeCloseTo((10 / 1080) * 100);
  });

  it("marks an item as missing (null) when the plan has no line for it", () => {
    const plans = [plan("2026-04", [{ itemId: LUZ, planned: 60, actual: 60 }])];
    const april = buildDashboardRows(2026, plans, [LUZ, AGUA])[3];
    expect(april.actualByItem[AGUA]).toBeNull();
  });

  it("uses null percent when the planned total is zero, but keeps the euro deviation", () => {
    const plans = [plan("2026-05", [{ itemId: LUZ, planned: 0, actual: 15 }])];
    const may = buildDashboardRows(2026, plans, [LUZ])[4];
    expect(may.deviation).toBe(15);
    expect(may.deviationPct).toBeNull();
  });

  it("ignores plans from other years", () => {
    const plans = [plan("2025-03", [{ itemId: LUZ, planned: 60, actual: 60 }])];
    expect(buildDashboardRows(2026, plans, [LUZ]).every((row) => !row.hasPlan)).toBe(true);
  });

  it("monthsOfYear returns YYYY-MM for each month", () => {
    expect(monthsOfYear(2026)[11]).toBe("2026-12");
  });
});
