import { useEffect, useState, type FormEvent } from "react";
import { reatomComponent } from "@reatom/react";
import { Check, Moon, Palette, Plus, Sun, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import {
  activeThemeAtom,
  createCustomThemeAction,
  createTheme,
  deleteCustomThemeAction,
  previewTheme,
  restoreActiveTheme,
  selectThemeAction,
  themeErrorAtom,
  themesAtom,
  type AppTheme,
  type ThemeMode,
  type ThemeSeed,
} from "@/entities/theme";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/shared/ui";

const COLOR_FIELDS: Array<{ key: keyof Omit<ThemeSeed, "mode">; label: string; hint: string }> = [
  { key: "background", label: "Фон", hint: "Основной фон приложения" },
  { key: "surface", label: "Поверхность", hint: "Панели, карточки и меню" },
  { key: "accent", label: "Акцент", hint: "Кнопки и активные элементы" },
  { key: "text", label: "Текст", hint: "Основной цвет текста" },
];

function ThemeCard({
  theme,
  active,
  onSelect,
  onDelete,
}: {
  theme: AppTheme;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className={`theme-card ${active ? "theme-card--active" : ""}`}>
      <button type="button" className="theme-card-main" onClick={onSelect}>
        <span className="theme-preview" style={{
          background: theme.colors.bg,
          borderColor: theme.colors.border,
        }}>
          <i style={{ background: theme.colors.panel }} />
          <i style={{ background: theme.colors.panel2 }} />
          <i style={{ background: theme.colors.accent }} />
          <b style={{ background: theme.colors.text }} />
        </span>
        <span className="theme-card-copy">
          <strong>{theme.name}</strong>
          <small>{theme.seed.mode === "dark" ? "Тёмная" : "Светлая"}</small>
        </span>
        {active && <span className="theme-active-mark"><Check /></span>}
      </button>
      {onDelete && (
        <button
          type="button"
          className="theme-delete"
          onClick={onDelete}
          aria-label={`Удалить тему ${theme.name}`}
        >
          <Trash2 />
        </button>
      )}
    </article>
  );
}

function ThemeColorField({
  colorKey,
  label,
  hint,
  value,
  onChange,
}: {
  colorKey: keyof Omit<ThemeSeed, "mode">;
  label: string;
  hint: string;
  value: string;
  onChange: (key: keyof Omit<ThemeSeed, "mode">, value: string) => void;
}) {
  return (
    <label className="theme-color-field">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(colorKey, event.currentTarget.value)}
      />
      <span><strong>{label}</strong><small>{hint}</small></span>
      <code>{value.toUpperCase()}</code>
    </label>
  );
}

export const ThemeCustomizer = reatomComponent(() => {
  const themes = themesAtom();
  const activeTheme = activeThemeAtom();
  const backendError = themeErrorAtom();
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState<ThemeSeed>(activeTheme.seed);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!editorOpen) return;
    previewTheme(createTheme("preview", "Новая тема", false, seed));
  }, [editorOpen, seed]);

  const changeEditorOpen = (next: boolean) => {
    setEditorOpen(next);
    if (next) {
      setName("");
      setSeed({ ...activeTheme.seed });
      setEditorError(null);
    } else {
      restoreActiveTheme();
    }
  };

  const selectTheme = async (theme: AppTheme) => {
    try {
      await selectThemeAction(theme.id);
      toast.success("Тема применена", { description: theme.name });
    } catch (error) {
      toast.error("Не удалось применить тему", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setEditorError(null);
    try {
      const theme = await createCustomThemeAction(name, seed);
      setEditorOpen(false);
      toast.success("Своя тема сохранена", { description: theme.name });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (theme: AppTheme) => {
    try {
      await deleteCustomThemeAction(theme.id);
      toast.success("Тема удалена", { description: theme.name });
    } catch (error) {
      toast.error("Не удалось удалить тему", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const updateSeed = (
    key: keyof Omit<ThemeSeed, "mode">,
    value: string,
  ) => setSeed((current) => ({ ...current, [key]: value }));

  const builtinThemes = themes.filter((theme) => theme.isBuiltin);
  const customThemes = themes.filter((theme) => !theme.isBuiltin);
  const preview = createTheme("preview-card", name || "Новая тема", false, seed);

  return (
    <section className="theme-settings">
      <header>
        <div>
          <span><Palette /></span>
          <div><h2>Цвета приложения</h2><p>Выберите готовую палитру или соберите собственную.</p></div>
        </div>
        <Button onClick={() => changeEditorOpen(true)}><Plus /> Создать тему</Button>
      </header>

      <div className="theme-section">
        <h3>Базовые темы</h3>
        <div className="theme-grid">
          {builtinThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={theme.id === activeTheme.id}
              onSelect={() => void selectTheme(theme)}
            />
          ))}
        </div>
      </div>

      {!!customThemes.length && (
        <div className="theme-section">
          <h3>Мои темы</h3>
          <div className="theme-grid">
            {customThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={theme.id === activeTheme.id}
                onSelect={() => void selectTheme(theme)}
                onDelete={() => void remove(theme)}
              />
            ))}
          </div>
        </div>
      )}

      {backendError && <p className="theme-error">{backendError}</p>}

      <Dialog open={editorOpen} onOpenChange={changeEditorOpen}>
        <DialogContent className="theme-editor">
          <form onSubmit={save}>
            <DialogHeader>
              <span className="dialog-hero-icon"><WandSparkles /></span>
              <div>
                <DialogTitle>Своя цветовая тема</DialogTitle>
                <DialogDescription>
                  Производные оттенки и контраст рассчитываются автоматически.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="theme-editor-layout">
              <div className="theme-editor-controls">
                <label className="dialog-field">
                  <span>Название</span>
                  <Input
                    value={name}
                    onChange={(event) =>
                      setName(Array.from(event.currentTarget.value).slice(0, 32).join(""))}
                    placeholder="Например, Тихий океан"
                    autoFocus
                  />
                  <small>{Array.from(name).length}/32</small>
                </label>

                <div className="theme-mode-picker">
                  <span>Режим интерфейса</span>
                  <div>
                    {([
                      ["dark", "Тёмный", Moon],
                      ["light", "Светлый", Sun],
                    ] as const).map(([mode, label, Icon]) => (
                      <button
                        type="button"
                        key={mode}
                        className={seed.mode === mode ? "is-selected" : ""}
                        onClick={() => setSeed((current) => ({
                          ...current,
                          mode: mode as ThemeMode,
                        }))}
                      >
                        <Icon /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="theme-color-fields">
                  {COLOR_FIELDS.map((field) => (
                    <ThemeColorField
                      key={field.key}
                      colorKey={field.key}
                      label={field.label}
                      hint={field.hint}
                      value={seed[field.key]}
                      onChange={updateSeed}
                    />
                  ))}
                </div>
              </div>

              <div className="theme-live-preview" style={{
                color: preview.colors.text,
                background: preview.colors.bg,
                borderColor: preview.colors.border,
              }}>
                <header style={{ background: preview.colors.panel }}>
                  <i style={{ background: preview.colors.accent }} />
                  <span><b>Resonance</b><small style={{ color: preview.colors.muted }}>Предпросмотр</small></span>
                </header>
                <div>
                  <span style={{ background: preview.colors.panel3, color: preview.colors.accent }}>
                    <Palette /> Медиатека
                  </span>
                  <article style={{ background: preview.colors.panel, borderColor: preview.colors.border }}>
                    <strong>Любимый трек</strong>
                    <small style={{ color: preview.colors.muted }}>Новый исполнитель</small>
                    <button type="button" style={{
                      background: preview.colors.accent,
                      color: preview.colors.accentContrast,
                    }}>▶</button>
                  </article>
                </div>
              </div>
            </div>

            {editorError && <p className="theme-error">{editorError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => changeEditorOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                Сохранить тему
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}, "ThemeCustomizer");
