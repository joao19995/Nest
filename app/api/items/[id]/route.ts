import { NextResponse } from "next/server";
import { categoryRepository } from "@/shared/repositories/category-repository";
import { itemRepository } from "@/shared/repositories/item-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const body = await request.json() as { name?: unknown; categoryId?: unknown; active?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });
    if (typeof body.categoryId !== "string" || !isUuid(body.categoryId)) {
      return NextResponse.json({ error: "ID de categoria inválido." }, { status: 400 });
    }
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "O estado active deve ser booleano." }, { status: 400 });

    const category = await categoryRepository.findById(body.categoryId);
    if (!category || !category.active) {
      return NextResponse.json({ error: "Categoria não encontrada ou inativa." }, { status: 400 });
    }
    const item = await itemRepository.update(id, { name, categoryId: body.categoryId, active: body.active });
    if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Could not update item.", error);
    return NextResponse.json({ error: "Não foi possível atualizar o item." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const item = await itemRepository.deactivate(id);
    if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Could not deactivate item.", error);
    return NextResponse.json({ error: "Não foi possível desativar o item." }, { status: 500 });
  }
}
