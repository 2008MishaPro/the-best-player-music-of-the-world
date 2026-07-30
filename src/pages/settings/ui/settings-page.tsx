import { reatomComponent } from "@reatom/react";
import { Database, FolderCog, ShieldCheck } from "lucide-react";
import { ThemeCustomizer } from "@/features/manage-theme";

export const SettingsPage = reatomComponent(() => (
  <section className="page page--settings">
    <header className="page-header">
      <div>
        <p className="eyebrow">Resonance</p>
        <h1>Настройки</h1>
        <p>Оформление приложения и локальное хранилище.</p>
      </div>
    </header>

    <ThemeCustomizer />

    <div className="settings-list settings-list--compact">
      <article>
        <span><Database /></span>
        <div>
          <strong>Локальная база</strong>
          <p>Метаданные, темы, плейлисты и история хранятся в SQLite</p>
        </div>
      </article>
      <article>
        <span><FolderCog /></span>
        <div>
          <strong>Исходные файлы</strong>
          <p>Музыка не копируется и остаётся в выбранных папках</p>
        </div>
      </article>
      <article>
        <span><ShieldCheck /></span>
        <div>
          <strong>Приватность</strong>
          <p>Приложение работает локально и не отправляет медиатеку в сеть</p>
        </div>
      </article>
    </div>
  </section>
), "SettingsPage");
