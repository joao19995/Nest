import { NextResponse } from "next/server";
import { monthlyPlanRepository } from "@/shared/repositories/monthly-plan-repository";
import { isValidMonth } from "@/shared/lib/category-template-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const yearParam = params.get("year");
    if (yearParam !== null) {
      const year = Number(yearParam);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return NextResponse.json({ error: "Indica um ano válido (YYYY)." }, { status: 400 });
      }
      return NextResponse.json(await monthlyPlanRepository.listByYear(year));
    }
    const month = params.get("month");
    if (!isValidMonth(month)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });

    const plan = await monthlyPlanRepository.findByMonth(month);
    if (!plan) return NextResponse.json({ error: "Este mês ainda não foi criado." }, { status: 404 });
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Could not load month.", error);
    return NextResponse.json({ error: "Não foi possível carregar o mês." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { month?: unknown };
    if (!isValidMonth(body.month)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });

    if (await monthlyPlanRepository.findByMonth(body.month)) {
      return NextResponse.json({ error: `O mês ${body.month} já existe.` }, { status: 409 });
    }

    const plan = await monthlyPlanRepository.create(body.month);
    if (!plan) {
      return NextResponse.json({ error: `Não existe um template configurado para este mês. Cria primeiro um template aplicável a ${body.month}.` }, { status: 400 });
    }
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Could not create month.", error);
    return NextResponse.json({ error: "Não foi possível criar o mês." }, { status: 500 });
  }
}
