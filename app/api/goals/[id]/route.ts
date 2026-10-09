import { NextResponse } from "next/server";
import { parseGoalDetails } from "@/app/api/goals/route";
import { findDeactivationBlockers } from "@/features/goals/domain/goal-template";
import { isUuid } from "@/shared/lib/uuid";
import { goalRepository } from "@/shared/repositories/goal-repository";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const parsed = parseGoalDetails(await request.json(), true);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = await goalRepository.update(id, parsed.details);
    if (!updated) return NextResponse.json({ error: "Objetivo não encontrado." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Could not update goal.", error);
    return NextResponse.json({ error: "Não foi possível editar o objetivo." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    // Objetivos inativos não podem receber dinheiro: se o objetivo tem
    // percentagem > 0 numa versão que se aplica a meses abertos (ou na
    // última versão), a desativação é recusada em vez de redistribuir em
    // silêncio — é preciso criar primeiro uma nova versão sem ele.
    const [templates, openMonths] = await Promise.all([
      goalTemplateRepository.findAll(),
      goalPlanRepository.listOpenMonths(),
    ]);
    const blockers = findDeactivationBlockers({ goalId: id, templates, openMonths: openMonths.map((item) => item.month) });
    if (blockers.length) {
      const versions = blockers.map((item) => item.validFrom).join(", ");
      return NextResponse.json(
        {
          error: `Não é possível desativar este objetivo: tem percentagem superior a 0% na versão da tabela com efeito a partir de ${versions}, que se aplica a meses abertos. Cria uma nova versão do template sem este objetivo e tenta de novo.`,
          blockingVersions: blockers.map((item) => item.validFrom),
        },
        { status: 409 },
      );
    }
    const archived = await goalRepository.archive(id);
    if (!archived) return NextResponse.json({ error: "Objetivo não encontrado." }, { status: 404 });
    return NextResponse.json({ id });
  } catch (error) {
    console.error("Could not delete goal.", error);
    return NextResponse.json({ error: "Não foi possível apagar o objetivo." }, { status: 500 });
  }
}
