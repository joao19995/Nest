import Link from "next/link";
import { SettingsEditor } from "./settings-editor";

export default function SettingsPage() {
  return <main className="shell compact-shell"><Link className="back-link" href="/">← Voltar ao plano mensal</Link><div className="page-heading"><p className="eyebrow">Configuração</p><h1>Regras do teu plano</h1><p className="lede">Edita os valores base que alimentam o cálculo de cada mês.</p></div><SettingsEditor /></main>;
}
