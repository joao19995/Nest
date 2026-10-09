import { NextResponse } from "next/server";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await goalPlanRepository.listClosedPlanned());
  } catch (error) {
    console.error("Could not load closed goal allocations.", error);
    return NextResponse.json({ error: "Não foi possível carregar o histórico fechado." }, { status: 500 });
  }
}
