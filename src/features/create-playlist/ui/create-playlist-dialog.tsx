import { useId, useState, type FormEvent } from "react";
import { ListMusic, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/shared/ui";
import { createPlaylistAction } from "../model/create-playlist.ts";

type CreatePlaylistDialogProps = {
  open: boolean;
  suggestedName: string;
  onOpenChange: (open: boolean) => void;
};

export function CreatePlaylistDialog({ open, suggestedName, onOpenChange }: CreatePlaylistDialogProps) {
  if (!open) return null;
  return <OpenCreatePlaylistDialog suggestedName={suggestedName} onOpenChange={onOpenChange} />;
}

function OpenCreatePlaylistDialog({ suggestedName, onOpenChange }: Omit<CreatePlaylistDialogProps, "open">) {
  const inputId = useId();
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Введите название плейлиста");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createPlaylistAction(trimmedName);
      toast.success("Плейлист создан", { description: trimmedName });
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <span className="dialog-icon"><ListMusic /></span>
            <div>
              <DialogTitle>Новый плейлист</DialogTitle>
              <DialogDescription>Соберите музыку под настроение, жанр или особый случай.</DialogDescription>
            </div>
          </DialogHeader>

          <div className="dialog-field">
            <label htmlFor={inputId}>Название</label>
            <Input
              id={inputId}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Например, Ночной город"
              maxLength={80}
              autoFocus
              aria-invalid={Boolean(error)}
            />
            {error && <p className="dialog-error">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={submitting}>Отмена</Button></DialogClose>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <LoaderCircle className="spin" />}
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
