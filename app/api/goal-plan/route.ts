import { NextResponse } from "next/server";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { getMonthFunding } from "@/shared/lib/goal-funding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month");
    if (!isValidMonth(month)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
    const plan = await goalPlanRepository.findByMonth(month);
    if (!plan) return NextResponse.json({ error: "Este mês ainda não foi criado." }, { status: 404 });
    await goalPlanRepository.ensureAllocations(plan.id);
    return NextResponse.json(await goalPlanRepository.findByMonth(month));
  } catch (error) {
    console.error("Could not load goal month.", error);
    return NextResponse.json({ error: "Não foi possível carregar o mês." }, { status: 500 });
  }
}

// O disponível é calculado (resto do ordenado) e não editável: snapshot no momento da criação.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { month?: unknown };
    if (!isValidMonth(body.month)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
    const existing = await goalPlanRepository.findByMonth(body.month);
    if (existing) return NextResponse.json({ error: `O mês ${body.month} já existe.` }, { status: 409 });
    const funding = await getMonthFunding(body.month);
    const plan = await goalPlanRepository.create(body.month, funding.available);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Could not create goal month.", error);
    return NextResponse.json({ error: "Não foi possível criar o mês." }, { status: 500 });
  }
}
