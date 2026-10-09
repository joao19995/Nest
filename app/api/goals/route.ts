import { NextResponse } from "next/server";
import type { GoalPriority, GoalTimeline } from "@/features/goals/domain/types";
import { goalRepository } from "@/shared/repositories/goal-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GOAL_PRIORITIES = ["GRANDE", "PEQUENO", "NICE_TO_HAVE"] as const;
export const GOAL_TIMELINES = ["T1", "T2", "T3", "T4", "ANUAL"] as const;

export type GoalDetailsInput = {
  name: string;
  targetAmount: number;
  priority: GoalPriority;
  timeline: GoalTimeline;
  realism: string;
  notes: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const DEFAULT_GOAL_DETAILS = {
  targetAmount: 0,
  priority: "NICE_TO_HAVE",
  timeline: "ANUAL",
  realism: "OK",
  notes: "",
} as const;

/**
 * Valida nome + detalhes do objetivo. Com requireDetails=false (criar),
 * os detalhes em falta usam os valores por omissão; com true (editar), têm
 * de vir todos. O orçamento é só informação/acompanhamento: nunca calcula
 * percentagens.
 */
export function parseGoalDetails(body: unknown, requireDetails: boolean): { details: GoalDetailsInput } | { error: string } {
  if (!isRecord(body)) return { error: "Pedido inválido." };
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
    return { error: "Indica um nome até 100 caracteres." };
  }
  const get = (key: keyof typeof DEFAULT_GOAL_DETAILS): unknown =>
    body[key] === undefined && !requireDetails ? DEFAULT_GOAL_DETAILS[key] : body[key];
  const targetAmount = get("targetAmount");
  if (typeof targetAmount !== "number" || !Number.isFinite(targetAmount) || targetAmount < 0) {
    return { error: "O orçamento tem de ser um número não negativo." };
  }
  const priority = get("priority");
  if (priority !== "GRANDE" && priority !== "PEQUENO" && priority !== "NICE_TO_HAVE") {
    return { error: "A categoria tem de ser GRANDE, PEQUENO ou NICE TO HAVE." };
  }
  const timeline = get("timeline");
  if (timeline !== "T1" && timeline !== "T2" && timeline !== "T3" && timeline !== "T4" && timeline !== "ANUAL") {
    return { error: "A timeline tem de ser T1, T2, T3, T4 ou ANUAL." };
  }
  const realism = get("realism");
  if (typeof realism !== "string" || realism.length > 50) {
    return { error: "O realismo tem de ter até 50 caracteres." };
  }
  const notes = get("notes");
  if (typeof notes !== "string" || notes.length > 2000) {
    return { error: "As notas têm de ter até 2000 caracteres." };
  }
  return {
    details: {
      name: (body.name as string).trim(),
      targetAmount: Math.round((targetAmount as number) * 100) / 100,
      priority: priority as GoalPriority,
      timeline: timeline as GoalTimeline,
      realism: (realism as string).trim(),
      notes: (notes as string).trim(),
    },
  };
}

export async function GET() {
  try {
    return NextResponse.json(await goalRepository.list());
  } catch (error) {
    console.error("Could not load goals.", error);
    return NextResponse.json({ error: "Não foi possível carregar os objetivos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = parseGoalDetails(await request.json(), false);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    return NextResponse.json(await goalRepository.create(parsed.details.name, parsed.details), { status: 201 });
  } catch (error) {
    console.error("Could not create goal.", error);
    return NextResponse.json({ error: "Não foi possível criar o objetivo." }, { status: 500 });
  }
}
