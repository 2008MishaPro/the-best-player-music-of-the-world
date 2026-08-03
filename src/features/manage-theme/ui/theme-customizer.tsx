import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { reatomComponent } from "@reatom/react";
import { Check, ImageOff, ImagePlus, Moon, Palette, Pencil, Plus, Sun, Trash2, WandSparkles } from "lucide-react";
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
  updateCustomThemeAction,
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

type ThemeColorKey = "background" | "surface" | "accent" | "text";

const COLOR_FIELDS: Array<{ key: ThemeColorKey; label: string; hint: string }> = [
  { key: "background", label: "Фон", hint: "Основной фон приложения" },
  { key: "surface", label: "Поверхность", hint: "Панели, карточки и меню" },
  { key: "accent", label: "Акцент", hint: "Кнопки и активные элементы" },
  { key: "text", label: "Текст", hint: "Основной цвет текста" },
];

const MAX_BACKGROUND_FILE_SIZE = 10 * 1024 * 1024;

const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === "string"
    ? resolve(reader.result)
    : reject(new Error("Не удалось прочитать изображение"));
  reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать изображение"));
  reader.readAsDataURL(file);
});

function ThemeCard({
  theme,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  theme: AppTheme;
  active: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className={`theme-card ${active ? "theme-card--active" : ""}`}>
      <button type="button" className="theme-card-main" onClick={onSelect}>
        <span className="theme-preview" style={{
          backgroundColor: theme.colors.bg,
          backgroundImage: theme.seed.backgroundImage
            ? `linear-gradient(color-mix(in srgb, ${theme.colors.bg} 34%, transparent), color-mix(in srgb, ${theme.colors.bg} 34%, transparent)), url("${theme.seed.backgroundImage}")`
            : undefined,
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
      {onEdit && (
        <button
          type="button"
          className="theme-edit"
          onClick={onEdit}
          aria-label={`Редактировать тему ${theme.name}`}
        >
          <Pencil />
        </button>
      )}
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
  colorKey: ThemeColorKey;
  label: string;
  hint: string;
  value: string;
  onChange: (key: ThemeColorKey, value: string) => void;
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
  const [editingTheme, setEditingTheme] = useState<AppTheme | null>(null);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState<ThemeSeed>(activeTheme.seed);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editorOpen) return;
    previewTheme(createTheme("preview", "Новая тема", false, seed));
  }, [editorOpen, seed]);

  const openCreateEditor = () => {
    setEditingTheme(null);
    setName("");
    setSeed({ ...activeTheme.seed });
    setEditorError(null);
    setEditorOpen(true);
  };

  const openEditEditor = (theme: AppTheme) => {
    setEditingTheme(theme);
    setName(theme.name);
    setSeed({ ...theme.seed });
    setEditorError(null);
    setEditorOpen(true);
  };

  const changeEditorOpen = (next: boolean) => {
    if (next) return;
    setEditorOpen(false);
    setEditingTheme(null);
    restoreActiveTheme();
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
      const theme = editingTheme
        ? await updateCustomThemeAction(editingTheme.id, name, seed)
        : await createCustomThemeAction(name, seed);
      setEditorOpen(false);
      setEditingTheme(null);
      toast.success(editingTheme ? "Тема обновлена" : "Своя тема сохранена", {
        description: theme.name,
      });
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
    key: ThemeColorKey,
    value: string,
  ) => setSeed((current) => ({ ...current, [key]: value }));

  const chooseBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (![/^image\/png$/, /^image\/jpe?g$/, /^image\/webp$/, /^image\/avif$/, /^image\/gif$/]
      .some((pattern) => pattern.test(file.type))) {
      setEditorError("Поддерживаются PNG, JPEG, WebP, AVIF и GIF");
      return;
    }
    if (file.size > MAX_BACKGROUND_FILE_SIZE) {
      setEditorError("Изображение должно занимать не больше 10 МБ");
      return;
    }
    try {
      const backgroundImage = await readImage(file);
      setSeed((current) => ({ ...current, backgroundImage }));
      setEditorError(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  };

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
        <Button onClick={openCreateEditor}><Plus /> Создать тему</Button>
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
                onEdit={() => openEditEditor(theme)}
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
                <DialogTitle>{editingTheme ? "Редактирование темы" : "Своя цветовая тема"}</DialogTitle>
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

                <div className="theme-background-field">
                  <div>
                    <span><ImagePlus /></span>
                    <p><strong>Фоновое изображение</strong><small>PNG, JPEG, WebP, AVIF или GIF до 10 МБ</small></p>
                  </div>
                  <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                    onChange={(event) => void chooseBackground(event)}
                    hidden
                  />
                  <div className="button-group">
                    <Button type="button" variant="secondary" size="sm" onClick={() => backgroundInputRef.current?.click()}>
                      <ImagePlus /> {seed.backgroundImage ? "Заменить" : "Выбрать изображение"}
                    </Button>
                    {seed.backgroundImage && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSeed((current) => ({ ...current, backgroundImage: null }))}>
                        <ImageOff /> Убрать
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="theme-live-preview" style={{
                color: preview.colors.text,
                backgroundColor: preview.colors.bg,
                backgroundImage: seed.backgroundImage
                  ? `linear-gradient(color-mix(in srgb, ${preview.colors.bg} 28%, transparent), color-mix(in srgb, ${preview.colors.bg} 28%, transparent)), url("${seed.backgroundImage}")`
                  : undefined,
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
                {editingTheme ? "Сохранить изменения" : "Сохранить тему"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}, "ThemeCustomizer");
