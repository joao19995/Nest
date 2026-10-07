import { NextResponse } from "next/server";
import { categoryRepository } from "@/shared/repositories/category-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCategoryType(value: unknown): value is "FIXED" | "VARIABLE" {
  return value === "FIXED" || value === "VARIABLE";
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const body = await request.json() as { name?: unknown; type?: unknown; active?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });
    if (!isCategoryType(body.type)) return NextResponse.json({ error: "O tipo deve ser FIXED ou VARIABLE." }, { status: 400 });
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "O estado active deve ser booleano." }, { status: 400 });

    const category = await categoryRepository.update(id, { name, type: body.type, active: body.active });
    if (!category) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Could not update category.", error);
    return NextResponse.json({ error: "Não foi possível atualizar a categoria." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const category = await categoryRepository.deactivate(id);
    if (!category) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Could not deactivate category.", error);
    return NextResponse.json({ error: "Não foi possível desativar a categoria." }, { status: 500 });
  }
}
