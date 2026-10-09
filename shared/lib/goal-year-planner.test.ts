import { describe, expect, it } from "vitest";
import { buildTemplateChangeSeeds, buildYearSeeds, computeAdjustRecalc, previewTemplateChange } from "./goal-year-planner";
import type { GoalTemplate } from "../../features/goals/domain/goal-template";

const templateJan: GoalTemplate = {
  id: "t1",
  validFrom: "2026-01",
  annualTotal: 0,
  entries: [
    { goalId: "a", percentage: 60 },
    { goalId: "b", percentage: 40 },
  ],
};

const templateJul: GoalTemplate = {
  id: "t2",
  validFrom: "2026-07",
  annualTotal: 0,
  entries: [
    { goalId: "a", percentage: 50 },
    { goalId: "b", percentage: 50 },
  ],
};

describe("buildYearSeeds", () => {
  it("resolve a versao aplicavel a cada mes", () => {
    const { seeds, missingMonths } = buildYearSeeds({
      year: 2026,
      funding: [
        { month: "2026-03", available: 1000 },
        { month: "2026-09", available: 1000 },
      ],
      templates: [templateJan, templateJul],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(missingMonths).toEqual([]);
    expect(seeds).toHaveLength(2);
    expect(seeds[0].allocations).toEqual([
      { goalId: "a", planned: 600 },
      { goalId: "b", planned: 400 },
    ]);
    expect(seeds[1].allocations).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
  });

  it("reporta meses sem template em vez de inventar distribuicao", () => {
    const { seeds, missingMonths } = buildYearSeeds({
      year: 2026,
      funding: [{ month: "2026-03", available: 1000 }],
      templates: [],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(seeds).toEqual([]);
    expect(missingMonths).toEqual(["2026-03"]);
  });
});

describe("buildTemplateChangeSeeds", () => {
  const storedPlans = [
    { planId: "p1", month: "2026-01", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    // Ajuste manual anterior ao validFrom: 700/300 em vez dos 600/400 da tabela.
    { planId: "p2", month: "2026-02", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 700 }, { goalId: "b", planned: 300 }] },
    { planId: "p8", month: "2026-08", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p9", month: "2026-09", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 500 }, { goalId: "b", planned: 500 }] },
  ];
  const fundingByMonth = new Map([
    ["2026-01", 1000],
    ["2026-02", 1200],
    ["2026-08", 1000],
    ["2026-09", 1000],
    ["2026-10", 1000],
  ]);
  const proposedEntries = [
    { goalId: "a", percentage: 50 },
    { goalId: "b", percentage: 50 },
  ];
  const effective = [...[templateJan], { id: "proposed", validFrom: "2026-07", annualTotal: 0, entries: proposedEntries }];

  function changeSeeds() {
    return buildTemplateChangeSeeds({
      year: 2026,
      validFrom: "2026-07",
      fundingByMonth,
      storedPlans,
      templates: effective,
      activeGoalIds: new Set(["a", "b"]),
    });
  }

  it("só inclui meses abertos >= validFrom mais criações em falta", () => {
    const scope = changeSeeds();
    // Fevereiro (aberto mas anterior, com ajuste manual e disponível mudado)
    // e os fechados ficam de fora; outubro sem plano entra como criação.
    expect(scope.seeds.map((item) => item.month)).toEqual(["2026-08", "2026-10"]);
    expect(scope.toCreate).toEqual(["2026-10"]);
    expect(scope.closedSkipped).toEqual(["2026-09"]);
    expect(scope.missingMonths).toEqual([]);
    expect(scope.seeds.find((item) => item.month === "2026-08")!.allocations).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
  });

  it("gravado fica igual ao after do preview e o mês anterior intacto", () => {
    const scope = changeSeeds();
    const preview = previewTemplateChange({
      validFrom: "2026-07",
      proposedEntries,
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(preview.affected.map((item) => item.month)).toEqual(["2026-08"]);
    expect(preview.toCreate).toEqual(["2026-10"]);
    // Simula a escrita do repositório: aplica as seeds verbatim nos meses
    // abertos e cria os meses em falta.
    const saved = new Map(
      storedPlans.map((item) => [item.month, {
        availableAmount: item.availableAmount,
        allocations: item.allocations.map((entry) => ({ ...entry })),
      }]),
    );
    for (const seed of scope.seeds) {
      saved.set(seed.month, { availableAmount: seed.availableAmount, allocations: seed.allocations });
    }
    for (const change of preview.affected) {
      expect(saved.get(change.month)!.allocations).toEqual(change.after);
    }
    // Mês aberto anterior com ajuste manual intacto, mesmo com disponível mudado.
    expect(saved.get("2026-02")!.allocations).toEqual([
      { goalId: "a", planned: 700 },
      { goalId: "b", planned: 300 },
    ]);
    expect(saved.get("2026-02")!.availableAmount).toBe(1000);
    // Fechados intactos e mês em falta criado com a nova tabela.
    expect(saved.get("2026-01")!.allocations).toEqual([
      { goalId: "a", planned: 600 },
      { goalId: "b", planned: 400 },
    ]);
    expect(saved.get("2026-09")!.allocations).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
    expect(saved.get("2026-10")!.allocations).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
  });
});

describe("computeAdjustRecalc", () => {
  const storedPlans = [
    { planId: "p1", month: "2026-01", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p2", month: "2026-02", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p3", month: "2026-03", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
  ];
  const fundingByMonth = new Map([
    ["2026-01", 1000],
    ["2026-02", 1000],
    ["2026-03", 1200],
  ]);

  it("preserva meses fechados e recalcula so futuros meses abertos", () => {
    const { toApply, futureChanges, missingMonths } = computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 700 }, { goalId: "b", planned: 300 }],
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    // Mês alvo com os valores do utilizador + março recalculado (disponível mudou).
    expect(toApply.map((item) => item.planId).sort()).toEqual(["p2", "p3"]);
    expect(toApply.find((item) => item.planId === "p2")!.allocations).toEqual([
      { goalId: "a", planned: 700 },
      { goalId: "b", planned: 300 },
    ]);
    expect(toApply.find((item) => item.planId === "p3")!.allocations).toEqual([
      { goalId: "a", planned: 720 },
      { goalId: "b", planned: 480 },
    ]);
    expect(futureChanges.map((item) => item.month)).toEqual(["2026-03"]);
    expect(missingMonths).toEqual([]);
  });

  it("nao altera o template ao ajustar o mes", () => {
    const snapshot = JSON.parse(JSON.stringify([templateJan]));
    computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 1000 }, { goalId: "b", planned: 0 }],
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect([templateJan]).toEqual(snapshot);
  });

  it("sem mudancas futuras nao propoe recalculos", () => {
    const { toApply, futureChanges } = computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }],
      storedPlans,
      fundingByMonth: new Map([["2026-02", 1000], ["2026-03", 1000]]),
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(toApply.map((item) => item.planId)).toEqual(["p2"]);
    expect(futureChanges).toEqual([]);
  });

  it("identifica meses fechados que ficam inalterados", () => {
    const { closedSkipped, toApply } = computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }],
      storedPlans: [
        ...storedPlans,
        { planId: "p4", month: "2026-04", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
      ],
      fundingByMonth: new Map([["2026-02", 1000], ["2026-03", 1000], ["2026-04", 2000]]),
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(closedSkipped).toEqual(["2026-04"]);
    expect(toApply.map((item) => item.planId)).not.toContain("p4");
  });
});

describe("previewTemplateChange", () => {
  const storedPlans = [
    { planId: "p1", month: "2026-01", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p2", month: "2026-02", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p8", month: "2026-08", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    { planId: "p9", month: "2026-09", availableAmount: 1000, closed: true, allocations: [{ goalId: "a", planned: 500 }, { goalId: "b", planned: 500 }] },
  ];
  const fundingByMonth = new Map([
    ["2026-01", 1000],
    ["2026-02", 1000],
    ["2026-08", 1000],
    ["2026-09", 1000],
  ]);

  it("nova versao futura so afeta meses abertos no seu alcance", () => {
    const preview = previewTemplateChange({
      validFrom: "2026-07",
      proposedEntries: [
        { goalId: "a", percentage: 50 },
        { goalId: "b", percentage: 50 },
      ],
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    // Fevereiro (anterior à versão) intacto; agosto recalculado; setembro fechado listado.
    expect(preview.affected.map((item) => item.month)).toEqual(["2026-08"]);
    expect(preview.affected[0].after).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
    expect(preview.closedSkipped).toEqual(["2026-09"]);
    expect(preview.missingMonths).toEqual([]);
  });

  it("meses fechados nunca aparecem como afetados", () => {
    const preview = previewTemplateChange({
      validFrom: "2026-01",
      proposedEntries: [
        { goalId: "a", percentage: 100 },
        { goalId: "b", percentage: 0 },
      ],
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(preview.affected.map((item) => item.month)).not.toContain("2026-01");
    expect(preview.affected.map((item) => item.month)).not.toContain("2026-09");
    expect(preview.closedSkipped).toEqual(["2026-01", "2026-09"]);
  });

  it("resolve a versao correta por mes com multiplas versoes", () => {
    const preview = previewTemplateChange({
      validFrom: "2026-07",
      proposedEntries: [
        { goalId: "a", percentage: 50 },
        { goalId: "b", percentage: 50 },
      ],
      storedPlans,
      fundingByMonth,
      templates: [templateJan, templateJul],
      activeGoalIds: new Set(["a", "b"]),
      replacedId: "t2",
      proposedId: "t2",
    });
    // Agosto e governado pela versao de julho (50/50), nao pela de janeiro:
    // o stored 600/400 aparece como afetado para 500/500. Fevereiro, regido
    // pela versao de janeiro, fica intacto.
    expect(preview.affected.map((item) => item.month)).toEqual(["2026-08"]);
    expect(preview.affected[0].after).toEqual([
      { goalId: "a", planned: 500 },
      { goalId: "b", planned: 500 },
    ]);
    expect(preview.closedSkipped).toEqual(["2026-09"]);
  });

  it("e so leitura: nao altera os planos guardados nem as tabelas", () => {
    const snapshot = JSON.stringify({ storedPlans, templates: [templateJan, templateJul] });
    previewTemplateChange({
      validFrom: "2026-07",
      proposedEntries: [{ goalId: "a", percentage: 50 }, { goalId: "b", percentage: 50 }],
      storedPlans,
      fundingByMonth,
      templates: [templateJan, templateJul],
      activeGoalIds: new Set(["a", "b"]),
    });
    expect(JSON.stringify({ storedPlans, templates: [templateJan, templateJul] })).toBe(snapshot);
  });
});

describe("objetivos inativos nunca recebem dinheiro", () => {
  const activeGoalIds = new Set(["a", "b"]);
  const templateWithInactive: GoalTemplate = {
    id: "t3",
    validFrom: "2026-03",
    annualTotal: 0,
    entries: [
      { goalId: "a", percentage: 60 },
      { goalId: "z", percentage: 40 },
    ],
  };

  it("buildYearSeeds reporta o mês como inválido e não o grava", () => {
    const { seeds, missingMonths, invalidMonths } = buildYearSeeds({
      year: 2026,
      funding: [
        { month: "2026-03", available: 1000 },
        { month: "2026-09", available: 1000 },
      ],
      templates: [templateWithInactive, templateJul],
      activeGoalIds,
    });
    expect(seeds.map((item) => item.month)).toEqual(["2026-09"]);
    expect(missingMonths).toEqual([]);
    expect(invalidMonths.map((item) => item.month)).toEqual(["2026-03"]);
    expect(invalidMonths[0].reason).toContain("z");
  });

  it("percentagem zero num objetivo inativo não invalida o mês", () => {
    const { seeds, invalidMonths } = buildYearSeeds({
      year: 2026,
      funding: [{ month: "2026-03", available: 1000 }],
      templates: [{
        id: "t0",
        validFrom: "2026-01",
        annualTotal: 0,
        entries: [{ goalId: "a", percentage: 100 }, { goalId: "z", percentage: 0 }],
      }],
      activeGoalIds,
    });
    expect(invalidMonths).toEqual([]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].allocations).toEqual([
      { goalId: "a", planned: 1000 },
      { goalId: "z", planned: 0 },
    ]);
  });

  it("template change: mês inválido fica fora das seeds e do preview", () => {
    const storedPlans = [
      { planId: "p8", month: "2026-08", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    ];
    const fundingByMonth = new Map([["2026-08", 1000]]);
    const proposedEntries = [
      { goalId: "a", percentage: 50 },
      { goalId: "z", percentage: 50 },
    ];
    const scope = buildTemplateChangeSeeds({
      year: 2026,
      validFrom: "2026-07",
      fundingByMonth,
      storedPlans,
      templates: [templateJan, { id: "proposed", validFrom: "2026-07", annualTotal: 0, entries: proposedEntries }],
      activeGoalIds,
    });
    expect(scope.seeds).toEqual([]);
    expect(scope.invalidMonths.map((item) => item.month)).toEqual(["2026-08"]);
    const preview = previewTemplateChange({
      validFrom: "2026-07",
      proposedEntries,
      storedPlans,
      fundingByMonth,
      templates: [templateJan],
      activeGoalIds,
    });
    expect(preview.affected).toEqual([]);
    expect(preview.invalidMonths.map((item) => item.month)).toEqual(["2026-08"]);
  });

  it("computeAdjustRecalc exclui futuros meses inválidos do toApply", () => {
    const stored = [
      { planId: "p2", month: "2026-02", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
      { planId: "p3", month: "2026-03", availableAmount: 1000, closed: false, allocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }] },
    ];
    const { toApply, futureChanges, invalidMonths } = computeAdjustRecalc({
      targetMonth: "2026-02",
      targetAvailable: 1000,
      targetAllocations: [{ goalId: "a", planned: 600 }, { goalId: "b", planned: 400 }],
      storedPlans: stored,
      fundingByMonth: new Map([["2026-02", 1000], ["2026-03", 1000]]),
      templates: [templateWithInactive],
      activeGoalIds,
    });
    expect(toApply.map((item) => item.planId)).toEqual(["p2"]);
    expect(futureChanges).toEqual([]);
    expect(invalidMonths.map((item) => item.month)).toEqual(["2026-03"]);
  });
});
