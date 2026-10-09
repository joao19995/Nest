import { NextResponse } from "next/server";
import { categoryTemplateRepository } from "@/shared/repositories/category-template-repository";
import { checkEntryReferences, isValidMonth, parseCategoryTemplateEntries, resolveEntryCategories } from "@/shared/lib/category-template-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const applicableTo = new URL(request.url).searchParams.get("applicableTo");
    if (applicableTo !== null) {
      if (!isValidMonth(applicableTo)) return NextResponse.json({ error: "Indica um mês válido (YYYY-MM)." }, { status: 400 });
      return NextResponse.json(await categoryTemplateRepository.findApplicable(applicableTo));
    }
    return NextResponse.json(await categoryTemplateRepository.findAll());
  } catch (error) {
    console.error("Could not list category templates.", error);
    return NextResponse.json({ error: "Não foi possível carregar os templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { validFrom?: unknown; entries?: unknown };
    if (!isValidMonth(body.validFrom)) return NextResponse.json({ error: "Indica um mês de início válido (YYYY-MM)." }, { status: 400 });

    const parsed = parseCategoryTemplateEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    if (await categoryTemplateRepository.findByValidFrom(body.validFrom)) {
      return NextResponse.json({ error: `Já existe um template a partir de ${body.validFrom}. Atualiza esse template em vez de criar outro.` }, { status: 409 });
    }

    const status = await categoryTemplateRepository.findReferenceStatus(parsed.entries.map((entry) => entry.itemId), parsed.entries.map((entry) => entry.accountId));
    const resolved = resolveEntryCategories(parsed.entries, status.items);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });
    const referenceError = checkEntryReferences(resolved.entries, status, new Set());
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

    return NextResponse.json(await categoryTemplateRepository.create(body.validFrom, resolved.entries), { status: 201 });
  } catch (error) {
    console.error("Could not create category template.", error);
    return NextResponse.json({ error: "Não foi possível criar o template." }, { status: 500 });
  }
}
