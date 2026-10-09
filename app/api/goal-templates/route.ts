import { NextResponse } from "next/server";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { isValidTemplateTotal } from "@/features/goals/domain/goal-template";
import type { GoalTemplateEntry } from "@/features/goals/domain/goal-template";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIORITIES: GoalTemplateEntry["priority"][] = ["HIGH", "MEDIUM", "LOW"];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseEntries(value: unknown): { entries: GoalTemplateEntry[] } | { error: string } {
  if (!Array.isArray(value) || !value.length) return { error: "Indica pelo menos um objetivo na tabela." };
  const seen = new Set<string>();
  const entries: GoalTemplateEntry[] = [];
  for (const item of value as { goalId?: unknown; percentage?: unknown; priority?: unknown; deadlineMonth?: unknown }[]) {
    if (!item || typeof item !== "object") return { error: "Linha da tabela inválida." };
    if (typeof item.goalId !== "string" || !isUuid(item.goalId)) return { error: "ID de objetivo inválido." };
    if (typeof item.percentage !== "number" || !Number.isFinite(item.percentage) || item.percentage < 0 || item.percentage > 100) {
      return { error: "Cada percentagem deve estar entre 0 e 100." };
    }
    const priority = item.priority === undefined ? "MEDIUM" : item.priority;
    if (!PRIORITIES.includes(priority as GoalTemplateEntry["priority"])) return { error: "Prioridade inválida (HIGH, MEDIUM, LOW)." };
    const deadlineMonth = item.deadlineMonth === undefined || item.deadlineMonth === null || item.deadlineMonth === "" ? null : item.deadlineMonth;
    if (deadlineMonth !== null && (typeof deadlineMonth !== "string" || !MONTH_PATTERN.test(deadlineMonth))) {
      return { error: "Prazo inválido (YYYY-MM ou vazio)." };
    }
    if (seen.has(item.goalId)) return { error: "O mesmo objetivo não pode aparecer duas vezes." };
    seen.add(item.goalId);
    entries.push({ goalId: item.goalId, percentage: item.percentage, priority: priority as GoalTemplateEntry["priority"], deadlineMonth });
  }
  if (!isValidTemplateTotal(entries)) return { error: "A tabela tem de somar 100%." };
  return { entries };
}

export async function GET(request: Request) {
  try {
    const applicableTo = new URL(request.url).searchParams.get("applicableTo");
    if (applicableTo !== null) {
      if (!isValidMonth(applicableTo)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
      return NextResponse.json(await goalTemplateRepository.findApplicable(applicableTo));
    }
    return NextResponse.json(await goalTemplateRepository.findAll());
  } catch (error) {
    console.error("Could not list goal templates.", error);
    return NextResponse.json({ error: "Não foi possível carregar os templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { validFrom?: unknown; annualTotal?: unknown; entries?: unknown };
    if (!isValidMonth(body.validFrom)) return NextResponse.json({ error: "Indica um mês de início válido (YYYY-MM)." }, { status: 400 });
    if (typeof body.annualTotal !== "number" || !Number.isFinite(body.annualTotal) || body.annualTotal < 0) {
      return NextResponse.json({ error: "O valor anual deve ser um número não negativo." }, { status: 400 });
    }
    const parsed = parseEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (await goalTemplateRepository.findByValidFrom(body.validFrom)) {
      return NextResponse.json({ error: `Já existe um template a partir de ${body.validFrom}. Atualiza esse template.` }, { status: 409 });
    }
    return NextResponse.json(await goalTemplateRepository.create(body.validFrom, body.annualTotal, parsed.entries), { status: 201 });
  } catch (error) {
    console.error("Could not create goal template.", error);
    return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });
  }
}
