import { NextResponse } from "next/server";
import { isValidTemplateTotal } from "@/features/goals/domain/goal-template";
import type { GoalTemplateEntry } from "@/features/goals/domain/goal-template";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { isUuid } from "@/shared/lib/uuid";

const PRIORITIES: GoalTemplateEntry["priority"][] = ["HIGH", "MEDIUM", "LOW"];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const body = (await request.json()) as { annualTotal?: unknown; entries?: unknown };
    if (typeof body.annualTotal !== "number" || !Number.isFinite(body.annualTotal) || body.annualTotal < 0) {
      return NextResponse.json({ error: "O valor anual deve ser um número não negativo." }, { status: 400 });
    }
    if (!Array.isArray(body.entries) || !body.entries.length) {
      return NextResponse.json({ error: "Indica pelo menos um objetivo na tabela." }, { status: 400 });
    }
    const seen = new Set<string>();
    const entries: GoalTemplateEntry[] = [];
    for (const item of body.entries as { goalId?: unknown; percentage?: unknown; priority?: unknown; deadlineMonth?: unknown }[]) {
      if (typeof item.goalId !== "string" || !isUuid(item.goalId)) return NextResponse.json({ error: "ID de objetivo inválido." }, { status: 400 });
      if (typeof item.percentage !== "number" || !Number.isFinite(item.percentage) || item.percentage < 0 || item.percentage > 100) {
        return NextResponse.json({ error: "Cada percentagem deve estar entre 0 e 100." }, { status: 400 });
      }
      const priority = item.priority === undefined ? "MEDIUM" : item.priority;
      if (!PRIORITIES.includes(priority as GoalTemplateEntry["priority"])) {
        return NextResponse.json({ error: "Prioridade inválida (HIGH, MEDIUM, LOW)." }, { status: 400 });
      }
      const deadlineMonth = item.deadlineMonth === undefined || item.deadlineMonth === null || item.deadlineMonth === "" ? null : item.deadlineMonth;
      if (deadlineMonth !== null && (typeof deadlineMonth !== "string" || !MONTH_PATTERN.test(deadlineMonth))) {
        return NextResponse.json({ error: "Prazo inválido (YYYY-MM ou vazio)." }, { status: 400 });
      }
      if (seen.has(item.goalId)) return NextResponse.json({ error: "O mesmo objetivo não pode aparecer duas vezes." }, { status: 400 });
      seen.add(item.goalId);
      entries.push({ goalId: item.goalId, percentage: item.percentage, priority: priority as GoalTemplateEntry["priority"], deadlineMonth });
    }
    if (!isValidTemplateTotal(entries)) return NextResponse.json({ error: "A tabela tem de somar 100%." }, { status: 400 });
    const updated = await goalTemplateRepository.replace(id, body.annualTotal, entries);
    if (!updated) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Could not update goal template.", error);
    return NextResponse.json({ error: "Não foi possível atualizar o template." }, { status: 500 });
  }
}
