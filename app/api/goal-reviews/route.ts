import { NextResponse } from "next/server";
import { goalRepository } from "@/shared/repositories/goal-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseYear(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 2000 && value <= 2100 ? value : null;
}

export async function GET(request: Request) {
  try {
    const year = parseYear(Number(new URL(request.url).searchParams.get("year")));
    if (year === null) return NextResponse.json({ error: "Indica um ano válido (YYYY)." }, { status: 400 });
    return NextResponse.json(await goalRepository.listReviewsByYear(year));
  } catch (error) {
    console.error("Could not load goal reviews.", error);
    return NextResponse.json({ error: "Não foi possível carregar as revisões." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { goalId?: unknown; year?: unknown; happiness?: unknown; reflection?: unknown };
    if (typeof body.goalId !== "string" || !isUuid(body.goalId)) {
      return NextResponse.json({ error: "ID de objetivo inválido." }, { status: 400 });
    }
    const year = parseYear(body.year);
    if (year === null) return NextResponse.json({ error: "Indica um ano válido (YYYY)." }, { status: 400 });
    if (body.happiness !== null && (typeof body.happiness !== "number" || !Number.isInteger(body.happiness) || body.happiness < 1 || body.happiness > 5)) {
      return NextResponse.json({ error: "A felicidade tem de ser um número de 1 a 5 (ou por avaliar)." }, { status: 400 });
    }
    if (typeof body.reflection !== "string" || body.reflection.length > 2000) {
      return NextResponse.json({ error: "A reflexão tem de ter até 2000 caracteres." }, { status: 400 });
    }
    if (!(await goalRepository.findById(body.goalId))) {
      return NextResponse.json({ error: "Objetivo não encontrado." }, { status: 404 });
    }
    return NextResponse.json(
      await goalRepository.upsertReview({ goalId: body.goalId, year, happiness: body.happiness, reflection: body.reflection.trim() }),
    );
  } catch (error) {
    console.error("Could not save goal review.", error);
    return NextResponse.json({ error: "Não foi possível guardar a revisão." }, { status: 500 });
  }
}
