import { describe, expect, it } from "vitest";
import { allocateMonth, AllocationError, assertAllocationsTotal, syncStoredAllocations } from "./allocate-month";

const CENTS = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) * 100);

describe("allocateMonth", () => {
  it("distribui 100% do disponivel com exatidao ao centimo", () => {
    const { allocations } = allocateMonth({
      availableAmount: 1505,
      entries: [
        { goalId: "brasil", percentage: 60 },
        { goalId: "reserva", percentage: 40 },
      ],
    });
    expect(allocations).toHaveLength(2);
    expect(CENTS(allocations.map((item) => item.planned))).toBe(150500);
  });

  it("soma exata mesmo com dizimas periodicas (100/3)", () => {
    const { allocations } = allocateMonth({
      availableAmount: 100,
      entries: [
        { goalId: "a", percentage: 33.33 },
        { goalId: "b", percentage: 33.33 },
        { goalId: "c", percentage: 33.34 },
      ],
    });
    expect(CENTS(allocations.map((item) => item.planned))).toBe(10000);
    for (const item of allocations) {
      expect(item.planned).toBe(Math.round(item.planned * 100) / 100);
    }
  });

  it("e deterministico: a mesma entrada da sempre a mesma saida", () => {
    const input = {
      availableAmount: 999.99,
      entries: [
        { goalId: "zebra", percentage: 12.5 },
        { goalId: "alfa", percentage: 37.5 },
        { goalId: "meio", percentage: 50 },
      ],
    };
    expect(allocateMonth(input)).toEqual(allocateMonth(input));
  });

  it("trata Poupanca como um objetivo normal", () => {
    const { allocations } = allocateMonth({
      availableAmount: 1000,
      entries: [
        { goalId: "poupanca", percentage: 70 },
        { goalId: "viagem", percentage: 30 },
      ],
    });
    const savings = allocations.find((item) => item.goalId === "poupanca")!;
    expect(savings.planned).toBeCloseTo(700, 2);
    expect(CENTS(allocations.map((item) => item.planned))).toBe(100000);
  });

  it("disponivel zero produz alocacoes zero", () => {
    const { allocations } = allocateMonth({
      availableAmount: 0,
      entries: [
        { goalId: "a", percentage: 50 },
        { goalId: "b", percentage: 50 },
      ],
    });
    expect(allocations).toEqual([
      { goalId: "a", planned: 0 },
      { goalId: "b", planned: 0 },
    ]);
  });

  it("sem template aplicavel falha de forma explicita", () => {
    expect(() => allocateMonth({ availableAmount: 100, entries: [] })).toThrowError(AllocationError);
    try {
      allocateMonth({ availableAmount: 100, entries: [] });
      expect.unreachable();
    } catch (cause) {
      expect((cause as AllocationError).code).toBe("NO_TEMPLATE");
    }
  });

  it("total diferente de 100% falha de forma explicita", () => {
    try {
      allocateMonth({ availableAmount: 100, entries: [{ goalId: "a", percentage: 90 }] });
      expect.unreachable();
    } catch (cause) {
      expect((cause as AllocationError).code).toBe("INVALID_TOTAL");
    }
  });
});

describe("assertAllocationsTotal", () => {
  it("aceita totais exatos ao centimo", () => {
    expect(() =>
      assertAllocationsTotal(
        [{ planned: 600 }, { planned: 400 }],
        1000,
      ),
    ).not.toThrow();
  });

  it("rejeita totais divergentes para abortar antes de gravar", () => {
    expect(() => assertAllocationsTotal([{ planned: 600 }, { planned: 400 }], 1000.01)).toThrowError(AllocationError);
  });
});

describe("syncStoredAllocations", () => {
  it("zera o planeado de objetivos removidos da tabela sem apagar o historico", () => {
    const result = syncStoredAllocations({
      stored: [
        { goalId: "savings", planned: 600, actual: 600 },
        { goalId: "holidays", planned: 400, actual: 100 },
      ],
      incoming: [{ goalId: "savings", planned: 1000 }],
    });
    expect(result).toEqual([
      { goalId: "savings", planned: 1000, actual: 600 },
      { goalId: "holidays", planned: 0, actual: 100 },
    ]);
  });

  it("obsoletos nao inflam o total mensal", () => {
    const result = syncStoredAllocations({
      stored: [
        { goalId: "savings", planned: 600, actual: 0 },
        { goalId: "holidays", planned: 400, actual: 0 },
      ],
      incoming: [{ goalId: "savings", planned: 1000 }],
    });
    const total = Math.round(result.reduce((sum, item) => sum + item.planned, 0) * 100);
    expect(total).toBe(100000);
  });

  it("preserva o reservado quando o planeado muda", () => {
    const result = syncStoredAllocations({
      stored: [
        { goalId: "a", planned: 600, actual: 250 },
        { goalId: "b", planned: 400, actual: 50 },
      ],
      incoming: [
        { goalId: "a", planned: 700 },
        { goalId: "b", planned: 300 },
      ],
    });
    expect(result).toEqual([
      { goalId: "a", planned: 700, actual: 250 },
      { goalId: "b", planned: 300, actual: 50 },
    ]);
  });

  it("mantem objetivos desativados com historico a zero sem os reintroduzir", () => {
    const result = syncStoredAllocations({
      stored: [
        { goalId: "a", planned: 500, actual: 500 },
        { goalId: "archived", planned: 500, actual: 200 },
      ],
      incoming: [{ goalId: "a", planned: 1000 }],
    });
    const archived = result.find((item) => item.goalId === "archived")!;
    expect(archived.planned).toBe(0);
    expect(archived.actual).toBe(200);
    expect(result.some((item) => item.goalId === "archived" && item.planned > 0)).toBe(false);
  });

  it("recálculo com alocacoes pre-existentes substitui todos os planeados", () => {
    const result = syncStoredAllocations({
      stored: [
        { goalId: "a", planned: 999, actual: 10 },
        { goalId: "b", planned: 1, actual: 20 },
        { goalId: "old", planned: 500, actual: 30 },
      ],
      incoming: [
        { goalId: "a", planned: 600 },
        { goalId: "b", planned: 400 },
      ],
    });
    expect(result.find((item) => item.goalId === "a")).toEqual({ goalId: "a", planned: 600, actual: 10 });
    expect(result.find((item) => item.goalId === "b")).toEqual({ goalId: "b", planned: 400, actual: 20 });
    expect(result.find((item) => item.goalId === "old")).toEqual({ goalId: "old", planned: 0, actual: 30 });
  });
});
