import { NextResponse } from "next/server";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { getMonthFunding, getYearFunding } from "@/shared/lib/goal-funding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const month = params.get("month");
    const year = params.get("year");
    if (month !== null) {
      if (!isValidMonth(month)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
      return NextResponse.json(await getMonthFunding(month));
    }
    if (year !== null) {
      if (!/^\d{4}$/.test(year)) return NextResponse.json({ error: "Indica um ano válido (YYYY)." }, { status: 400 });
      return NextResponse.json(await getYearFunding(Number(year)));
    }
    return NextResponse.json({ error: "Indica month (YYYY-MM) ou year (YYYY)." }, { status: 400 });
  } catch (error) {
    console.error("Could not load goals funding.", error);
    return NextResponse.json({ error: "Não foi possível calcular o disponível." }, { status: 500 });
  }
}
