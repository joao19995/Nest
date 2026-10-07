import { NextResponse } from "next/server";
import { categoryRepository } from "@/shared/repositories/category-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCategoryType(value: unknown): value is "FIXED" | "VARIABLE" {
  return value === "FIXED" || value === "VARIABLE";
}

export async function GET() {
  try {
    return NextResponse.json(await categoryRepository.findAll());
  } catch (error) {
    console.error("Could not list categories.", error);
    return NextResponse.json({ error: "Não foi possível carregar as categorias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; type?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });
    if (!isCategoryType(body.type)) return NextResponse.json({ error: "O tipo deve ser FIXED ou VARIABLE." }, { status: 400 });

    return NextResponse.json(await categoryRepository.create({ name, type: body.type, active: true }), { status: 201 });
  } catch (error) {
    console.error("Could not create category.", error);
    return NextResponse.json({ error: "Não foi possível criar a categoria." }, { status: 500 });
  }
}
