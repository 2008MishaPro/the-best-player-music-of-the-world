import { reatomComponent } from "@reatom/react";
import { ThemeCustomizer } from "@/features/manage-theme";

export const SettingsPage = reatomComponent(() => (
  <section className="page page--settings">
    <header className="page-header">
      <div>
        <p className="eyebrow">Resonance</p>
        <h1>Настройки</h1>
        <p>Оформление приложения.</p>
      </div>
    </header>

    <ThemeCustomizer />
  </section>
), "SettingsPage");
