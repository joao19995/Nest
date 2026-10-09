import { NextResponse } from "next/server";
import { goalRepository } from "@/shared/repositories/goal-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return NextResponse.json({ error: "Indica um nome até 100 caracteres." }, { status: 400 });
    }
    return NextResponse.json(await goalRepository.create(body.name.trim()), { status: 201 });
  } catch (error) {
    console.error("Could not create goal.", error);
    return NextResponse.json({ error: "Não foi possível criar o objetivo." }, { status: 500 });
  }
}
