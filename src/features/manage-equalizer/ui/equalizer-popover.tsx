import { useEffect, useRef, useState, type FormEvent } from "react";
import { reatomComponent } from "@reatom/react";
import { AudioLines, RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteEqualizerPresetAction,
  equalizerBundleAtom,
  equalizerErrorAtom,
  equalizerLoadingAtom,
  previewEqualizerAction,
  saveEqualizerPresetAction,
  setEqualizerAction,
  type EqualizerPreset,
  type EqualizerState,
} from "@/entities/equalizer";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui";

const formatFrequency = (frequency: number) =>
  frequency >= 1_000 ? `${frequency / 1_000}k` : String(frequency);
const formatDb = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

export const EqualizerPopover = reatomComponent(() => {
  const bundle = equalizerBundleAtom();
  const loading = equalizerLoadingAtom();
  const backendError = equalizerErrorAtom();
  const [open, setOpen] = useState(false);
  const [bands, setBands] = useState(bundle.state.bands);
  const [preampDb, setPreampDb] = useState(bundle.state.preampDb);
  const [enabled, setEnabled] = useState(bundle.state.enabled);
  const [activePresetId, setActivePresetId] = useState<string | null>(
    bundle.state.activePresetId,
  );
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequest = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    setBands(bundle.state.bands);
    setPreampDb(bundle.state.preampDb);
    setEnabled(bundle.state.enabled);
    setActivePresetId(bundle.state.activePresetId);
  }, [bundle.state]);

  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }, []);

  const currentState = (
    next: Partial<EqualizerState> = {},
  ): EqualizerState => ({
    enabled,
    bands,
    preampDb,
    activePresetId,
    ...next,
  });

  const preview = (nextBands: number[], nextPreamp: number, nextEnabled = enabled) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewRequest.current = previewRequest.current
        .catch(() => undefined)
        .then(() => previewEqualizerAction(nextEnabled, nextBands, nextPreamp))
        .catch(() => undefined);
    }, 35);
  };

  const commit = async (state: EqualizerState) => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    try {
      await previewRequest.current;
      await setEqualizerAction(state);
    } catch (error) {
      toast.error("Не удалось применить эквалайзер", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const changeBand = (index: number, value: number) => {
    const next = bands.map((gain, bandIndex) => bandIndex === index ? value : gain);
    setBands(next);
    setActivePresetId(null);
    preview(next, preampDb);
  };

  const choosePreset = (preset: EqualizerPreset) => {
    setBands(preset.bands);
    setPreampDb(preset.preampDb);
    setEnabled(true);
    setActivePresetId(preset.id);
    void commit({
      enabled: true,
      bands: preset.bands,
      preampDb: preset.preampDb,
      activePresetId: preset.id,
    });
  };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    preview(bands, preampDb, next);
    void commit(currentState({ enabled: next }));
  };

  const reset = () => {
    const flat = bundle.presets.find((preset) => preset.id === "builtin-flat");
    if (flat) choosePreset(flat);
  };

  const savePreset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = presetName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const preset = await saveEqualizerPresetAction(name, bands, preampDb);
      setActivePresetId(preset.id);
      setEnabled(true);
      setPresetName("");
      setSaveOpen(false);
      toast.success("Пресет сохранён", { description: preset.name });
    } catch (error) {
      toast.error("Не удалось сохранить пресет", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const activePreset = bundle.presets.find((preset) => preset.id === activePresetId);
  const builtinPresets = bundle.presets.filter((preset) => preset.isBuiltin);
  const customPresets = bundle.presets.filter((preset) => !preset.isBuiltin);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={enabled ? "is-active" : ""}
          aria-label="Открыть эквалайзер"
        >
          <SlidersHorizontal />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="equalizer-popover" align="end" side="top">
        <header className="equalizer-header">
          <span className="equalizer-icon"><AudioLines /></span>
          <div>
            <strong>Эквалайзер</strong>
            <small>Настройте звучание под себя</small>
          </div>
          <button
            type="button"
            className="equalizer-switch"
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
          >
            <span />
          </button>
        </header>

        <div className="equalizer-preset-row">
          <label>
            <span>Пресет</span>
            <select
              value={activePresetId ?? ""}
              onChange={(event) => {
                const preset = bundle.presets.find((item) => item.id === event.currentTarget.value);
                if (preset) choosePreset(preset);
              }}
              disabled={loading}
            >
              {!activePresetId && <option value="">Пользовательская настройка</option>}
              <optgroup label="Базовые">
                {builtinPresets.map((preset) => (
                  <option value={preset.id} key={preset.id}>{preset.name}</option>
                ))}
              </optgroup>
              {!!customPresets.length && (
                <optgroup label="Мои пресеты">
                  {customPresets.map((preset) => (
                    <option value={preset.id} key={preset.id}>{preset.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {activePreset && !activePreset.isBuiltin && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Удалить пользовательский пресет"
              onClick={() => void deleteEqualizerPresetAction(activePreset)}
            >
              <Trash2 />
            </Button>
          )}
        </div>

        <div className={`equalizer-bands ${enabled ? "" : "equalizer-bands--disabled"}`}>
          <div className="equalizer-scale" aria-hidden="true">
            <span>+12</span><span>0</span><span>−12</span>
          </div>
          {bands.map((gain, index) => (
            <label className="equalizer-band" key={bundle.frequencies[index]}>
              <output>{formatDb(gain)}</output>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={gain}
                aria-label={`${formatFrequency(bundle.frequencies[index])} Гц`}
                onChange={(event) => changeBand(index, Number(event.currentTarget.value))}
                onPointerUp={(event) => {
                  const value = Number(event.currentTarget.value);
                  const next = bands.map((item, bandIndex) =>
                    bandIndex === index ? value : item);
                  void commit(currentState({ bands: next, activePresetId: null }));
                }}
                onKeyUp={(event) => {
                  const value = Number(event.currentTarget.value);
                  const next = bands.map((item, bandIndex) =>
                    bandIndex === index ? value : item);
                  void commit(currentState({ bands: next, activePresetId: null }));
                }}
              />
              <span>{formatFrequency(bundle.frequencies[index])}</span>
            </label>
          ))}
        </div>

        <label className="equalizer-preamp">
          <span>Предусиление <small>защита от перегруза</small></span>
          <input
            type="range"
            min={-12}
            max={0}
            step={0.5}
            value={preampDb}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              setPreampDb(next);
              setActivePresetId(null);
              preview(bands, next);
            }}
            onPointerUp={(event) => void commit(currentState({
              preampDb: Number(event.currentTarget.value),
              activePresetId: null,
            }))}
            onKeyUp={(event) => void commit(currentState({
              preampDb: Number(event.currentTarget.value),
              activePresetId: null,
            }))}
          />
          <output>{formatDb(preampDb)} дБ</output>
        </label>

        {backendError && <p className="equalizer-error">{backendError}</p>}

        <footer className="equalizer-footer">
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            <RotateCcw /> Сбросить
          </Button>
          {saveOpen ? (
            <form onSubmit={savePreset}>
              <Input
                value={presetName}
                onChange={(event) =>
                  setPresetName(Array.from(event.currentTarget.value).slice(0, 32).join(""))
                }
                placeholder="Название пресета"
                autoFocus
              />
              <Button type="submit" size="sm" disabled={saving || !presetName.trim()}>
                Сохранить
              </Button>
            </form>
          ) : (
            <Button type="button" size="sm" onClick={() => setSaveOpen(true)}>
              <Save /> Сохранить пресет
            </Button>
          )}
        </footer>
      </PopoverContent>
    </Popover>
  );
}, "EqualizerPopover");
