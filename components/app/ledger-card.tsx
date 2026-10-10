import * as React from "react";
import { Lock, PiggyBank, Scale, Wallet } from "lucide-react";
import { formatEuro } from "@/shared/ui/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/app/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type LedgerRow = {
  id: string;
  name: string;
  sub?: string;
  planned: number;
  actual: number;
};

function euro(value: number) {
  return formatEuro(value);
}

// Input numérico "invisível" das linhas do extrato: só mostra borda no hover/focus.
export function LedgerNumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      {...props}
      className="w-[118px] border-transparent bg-transparent text-right font-bold tabular-nums shadow-none hover:border-line hover:bg-input-bg focus:border-primary focus:bg-white"
    />
  );
}

// Cartão partilhado Despesas ↔ Objetivos: cabeçalho, 3 stats e tabela
// (Entidade, Planeado, Real, Desvio) com barra de consumo. O desvio e a barra
// são calculados aqui para os dois lados nunca divergirem; as células
// editáveis vêm por render props porque cada lado tem os seus rascunhos.
export function LedgerCard({
  icon,
  eyebrow,
  closed,
  description,
  totalsAriaLabel,
  plannedTotal,
  actualTotal,
  statNotes,
  entityLabel,
  rows,
  renderPlanned,
  renderActual,
  emptyMessage,
  footer,
  tone = "spend",
}: {
  icon: React.ReactNode;
  eyebrow: string;
  closed: boolean;
  description?: React.ReactNode;
  totalsAriaLabel: string;
  plannedTotal: number;
  actualTotal: number;
  statNotes?: [string, string, string];
  entityLabel: string;
  rows: LedgerRow[];
  renderPlanned?: (row: LedgerRow) => React.ReactNode;
  renderActual: (row: LedgerRow) => React.ReactNode;
  emptyMessage?: string;
  footer?: React.ReactNode;
  // spend (despesas): acima do planeado é mau. save (objetivos): acima é bom.
  tone?: "spend" | "save";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          {icon}
          <p className="m-0 text-[10px] font-bold uppercase tracking-[1.5px] text-primary">{eyebrow}</p>
          {closed
            ? <Badge variant="closed" dot className="ml-auto"><Lock size={12} aria-hidden="true" />Fechado</Badge>
            : <Badge variant="open" dot className="ml-auto">Aberto</Badge>}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <section aria-label={totalsAriaLabel} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard eyebrow="Planeado" value={euro(plannedTotal)} note={statNotes?.[0]} variant="muted" icon={Wallet} />
          <StatCard eyebrow="Real" value={euro(actualTotal)} note={statNotes?.[1]} variant="muted" icon={PiggyBank} />
          <StatCard eyebrow="Desvio" value={euro(actualTotal - plannedTotal)} note={statNotes?.[2]} variant="muted" icon={Scale} />
        </section>
        <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-paper">
              <TableHead>{entityLabel}</TableHead>
              <TableHead className="text-right">Planeado</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Desvio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const diff = row.actual - row.planned;
              const pct = row.planned > 0 ? row.actual / row.planned : row.actual > 0 ? 1 : 0;
              const over = diff > 0.005;
              const saved = diff < -0.005;
              // Nas despesas, ficar acima do planeado é mau; nos objetivos é bom.
              const bad = tone === "save" ? saved : over;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="flex min-w-[150px] flex-col gap-1.5">
                      <span className="flex flex-col">
                        <strong className="text-[13px] text-ink">{row.name}</strong>
                        {row.sub && <span className="text-[11px] text-muted">{row.sub}</span>}
                      </span>
                      <span
                        className="h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-line-soft"
                        role="img"
                        aria-label={`Consumo de ${row.name}: ${Math.round(pct * 100)}% do planeado`}
                      >
                        <span
                          className={`block h-full rounded-full ${bad ? "bg-terra-dark" : "bg-primary"}`}
                          style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                        />
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {renderPlanned ? (
                      renderPlanned(row)
                    ) : (
                      <span className="flex justify-end tabular-nums text-muted">{euro(row.planned)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex justify-end">{renderActual(row)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex flex-col items-end gap-0.5">
                      <strong
                        className={`tabular-nums ${bad ? "text-terra-dark" : over || saved ? "text-primary-dark" : "text-muted"}`}
                      >
                        {over ? `+${euro(diff)}` : euro(diff)}
                      </strong>
                      <span className="text-[11px] tabular-nums text-faint">
                        {row.planned > 0 ? `${Math.round((diff / row.planned) * 100)}%` : "—"}
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        {rows.length === 0 && emptyMessage && <Alert variant="muted">{emptyMessage}</Alert>}
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
