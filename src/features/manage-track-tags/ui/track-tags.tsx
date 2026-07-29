import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";
import type { Track, TrackTagColor } from "@/entities/track";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui";
import { createTrackTagAction, deleteTrackTagAction } from "../model/manage-track-tags.ts";

const PALETTE: Array<{ color: TrackTagColor; label: string }> = [
  { color: "amber", label: "Янтарный" },
  { color: "rose", label: "Розовый" },
  { color: "violet", label: "Фиолетовый" },
  { color: "blue", label: "Синий" },
  { color: "cyan", label: "Голубой" },
  { color: "emerald", label: "Зелёный" },
  { color: "slate", label: "Серый" },
];

export function TrackTags({ track }: { track: Track }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<TrackTagColor>("amber");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = Array.from(label).length;

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setLabel("");
      setError(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = label.trim();
    if (!value) {
      setError("Введите текст метки");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTrackTagAction(track.id, value, color);
      changeOpen(false);
      toast.success("Метка добавлена");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (tagId: string) => {
    try {
      await deleteTrackTagAction(track.id, tagId);
    } catch (reason) {
      toast.error("Не удалось удалить метку", {
        description: reason instanceof Error ? reason.message : String(reason),
      });
    }
  };

  return (
    <div className="track-tags-cell">
      {track.tags.map((tag) => (
        <span className={`micro-tag micro-tag--${tag.color}`} key={tag.id} title={tag.label}>
          <span>{tag.label}</span>
          <button type="button" onClick={() => void remove(tag.id)} aria-label={`Удалить метку ${tag.label}`}><X /></button>
        </span>
      ))}
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button className="add-micro-tag" size="icon" variant="ghost" aria-label="Добавить метку">
            {track.tags.length ? <Plus /> : <Tag />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="tag-popover" align="start">
          <form onSubmit={submit}>
            <header><span className="tag-popover-icon"><Tag /></span><div><strong>Новая метка</strong><small>Короткая заметка о треке</small></div></header>
            <div className="tag-input-wrap">
              <Input
                value={label}
                onChange={(event) => setLabel(Array.from(event.currentTarget.value).slice(0, 24).join(""))}
                placeholder="Например, ночной вайб"
                autoFocus
                aria-invalid={Boolean(error)}
              />
              <span>{length}/24</span>
            </div>
            <div className="tag-palette" aria-label="Цвет метки">
              {PALETTE.map((item) => (
                <button
                  type="button"
                  className={`tag-color tag-color--${item.color} ${color === item.color ? "tag-color--selected" : ""}`}
                  key={item.color}
                  onClick={() => setColor(item.color)}
                  aria-label={item.label}
                  aria-pressed={color === item.color}
                />
              ))}
            </div>
            {error && <p className="tag-popover-error">{error}</p>}
            <footer><Button type="button" variant="ghost" size="sm" onClick={() => changeOpen(false)}>Отмена</Button><Button type="submit" size="sm" disabled={submitting || !label.trim()}>{submitting && <LoaderCircle className="spin" />}Добавить</Button></footer>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
