import { SettingsEditor } from "./settings-editor";
import { AppNav } from "@/shared/ui/app-nav";

export default function SettingsPage() {
  return <main className="shell compact-shell"><AppNav active="settings" /><div className="page-heading"><p className="eyebrow">Configuração</p><h1>Regras globais</h1><p className="lede">Define as regras que alimentam todos os meses e o plano anual.</p></div><SettingsEditor /></main>;
}
