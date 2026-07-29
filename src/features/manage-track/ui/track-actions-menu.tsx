import { useState } from "react";
import { FolderOpen, LoaderCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/entities/track";
import { trackDisplayTitle } from "@/entities/track";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui";
import { removeTrackFromLibraryAction, revealTrackAction } from "../model/manage-track.ts";

type TrackActionsMenuProps = {
  track: Track;
};

export function TrackActionsMenu({ track }: TrackActionsMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const reveal = async () => {
    try {
      await revealTrackAction(track.filePath);
    } catch (error) {
      toast.error("Не удалось открыть расположение", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await removeTrackFromLibraryAction(track.id);
      toast.success("Трек удалён из медиатеки", { description: "Исходный файл остался на диске." });
      setConfirmOpen(false);
    } catch (error) {
      toast.error("Не удалось удалить трек", {
        description: error instanceof Error ? error.message : String(error),
      });
      setRemoving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Меню трека ${trackDisplayTitle(track)}`}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={track.isMissing} onSelect={() => void reveal()}>
            <FolderOpen />
            <span>Открыть расположение</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            <span>Удалить из медиатеки</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={(open) => !removing && setConfirmOpen(open)}>
        <DialogContent className="dialog-content--compact">
          <DialogHeader>
            <span className="dialog-icon dialog-icon--danger"><Trash2 /></span>
            <div>
              <DialogTitle>Удалить из медиатеки?</DialogTitle>
              <DialogDescription>«{trackDisplayTitle(track)}» пропадёт из коллекции и плейлистов.</DialogDescription>
            </div>
          </DialogHeader>
          <p className="remove-track-note"><FolderOpen />Сам аудиофайл останется на диске.</p>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={removing}>Отмена</Button></DialogClose>
            <Button type="button" variant="destructive" disabled={removing} onClick={() => void remove()}>
              {removing && <LoaderCircle className="spin" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
