"use client";

import { useEffect, useState } from "react";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { loadFinanceState, resetFinanceState, saveFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { Money } from "@/shared/ui/money";
import type { FinanceState } from "@/features/monthly-plan/domain/types";

export function SettingsEditor() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void loadFinanceState(initialFinanceState).then(setState).catch(showFinanceStorageError); }, []);
  const configuration = state.configuration;
  function update(changes: Partial<typeof configuration>) { setState((current) => ({ ...current, configuration: { ...current.configuration, ...changes } })); setSaved(false); }
  function save() { saveFinanceState(state); setSaved(true); }
  function reset() { resetFinanceState(); void loadFinanceState(initialFinanceState).then(setState).catch(showFinanceStorageError); setSaved(false); }

  return <><div className="editor-actions"><button className="secondary-button" onClick={reset}>Repor exemplos</button><button className="save-button" onClick={save}>{saved ? "Guardado" : "Guardar configurações"}</button></div><section className="settings-section"><div className="section-title"><div><p className="eyebrow">Regras globais</p><h2>Planeamento financeiro</h2></div><span className="settings-status">Aplicadas ao cálculo mensal</span></div><p className="form-note">Os gastos fixos são agora definidos pelas categorias marcadas como <strong>Fixo</strong>.</p></section></>;
}
