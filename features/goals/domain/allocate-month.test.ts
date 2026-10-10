import { describe, expect, it } from "vitest";
import { allocateMonth, AllocationError } from "./allocate-month";

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
