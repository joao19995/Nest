import { describe, expect, it } from "vitest";
import { goalYearTracking, timelineEndMonth } from "./goal-tracking";

const goals = [
  { id: "a", name: "Madeira", targetAmount: 800, timeline: "T1" as const },
  { id: "b", name: "Bustelo", targetAmount: 20000, timeline: "ANUAL" as const },
];

const plans = [
  {
    month: "2026-01",
    allocations: [
      { goalId: "a", planned: 400, actual: 400 },
      { goalId: "b", planned: 500, actual: 100 },
    ],
  },
  {
    month: "2026-02",
    allocations: [
      { goalId: "a", planned: 400, actual: 100 },
      { goalId: "b", planned: 500, actual: 0 },
    ],
  },
  {
    month: "2025-12",
    allocations: [{ goalId: "a", planned: 999, actual: 999 }],
  },
];

describe("goal-tracking", () => {
  it("mapeia o fim da timeline por trimestre", () => {
    expect(timelineEndMonth("T1", 2026)).toBe("2026-03");
    expect(timelineEndMonth("T2", 2026)).toBe("2026-06");
    expect(timelineEndMonth("T3", 2026)).toBe("2026-09");
    expect(timelineEndMonth("T4", 2026)).toBe("2026-12");
    expect(timelineEndMonth("ANUAL", 2026)).toBe("2026-12");
  });

  it("acumula planeado e reservado do ano e calcula a falta", () => {
    const tracking = goalYearTracking({ goals, plans, year: 2026, currentMonth: "2026-02" });
    const madeira = tracking.find((item) => item.goalId === "a")!;
    // Planos de 2025 ignorados.
    expect(madeira.plannedTotal).toBe(800);
    expect(madeira.actualTotal).toBe(500);
    expect(madeira.missing).toBe(300);
    const bustelo = tracking.find((item) => item.goalId === "b")!;
    expect(bustelo.plannedTotal).toBe(1000);
    expect(bustelo.actualTotal).toBe(100);
    expect(bustelo.missing).toBe(19900);
  });

  it("marca em risco quando o fim da timeline passou e falta reservar", () => {
    const tracking = goalYearTracking({ goals, plans, year: 2026, currentMonth: "2026-04" });
    // T1 (mar) passou e 500 < 800.
    expect(tracking.find((item) => item.goalId === "a")!.atRisk).toBe(true);
    // ANUAL (dez) ainda não chegou.
    expect(tracking.find((item) => item.goalId === "b")!.atRisk).toBe(false);
  });

  it("fim da timeline no mês atual conta como em risco", () => {
    const tracking = goalYearTracking({ goals, plans, year: 2026, currentMonth: "2026-03" });
    expect(tracking.find((item) => item.goalId === "a")!.atRisk).toBe(true);
  });

  it("alvo cumprido ou nulo nunca fica em risco", () => {
    const tracking = goalYearTracking({
      goals: [
        { id: "a", name: "Madeira", targetAmount: 500, timeline: "T1" },
        { id: "c", name: "Semanal", targetAmount: 0, timeline: "ANUAL" },
      ],
      plans,
      year: 2026,
      currentMonth: "2026-12",
    });
    expect(tracking.find((item) => item.goalId === "a")!.atRisk).toBe(false);
    expect(tracking.find((item) => item.goalId === "c")!.atRisk).toBe(false);
    expect(tracking.find((item) => item.goalId === "c")!.missing).toBe(0);
  });
});
