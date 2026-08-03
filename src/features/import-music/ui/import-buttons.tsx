import { useEffect } from "react";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { FileAudio, FolderPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui";
import {
  clearImportErrorAction,
  clearImportSummaryAction,
  importDirectoryAction,
  importErrorAtom,
  importFilesAction,
  importLoadingAtom,
  importSummaryAtom,
} from "../model/import-music.ts";

export const ImportButtons = reatomComponent(() => {
  const loading = importLoadingAtom();
  const error = importErrorAtom();
  const summary = importSummaryAtom();

  useEffect(() => {
    if (!error) return;
    toast.error("Импорт не выполнен", { id: "import-feedback", description: error });
    clearImportErrorAction();
  }, [error]);

  useEffect(() => {
    if (!summary) return;
    const processed = summary.imported + summary.updated;
    if (processed > 0) {
      toast.success(`Добавлено треков: ${processed}`, {
        id: "import-feedback",
        description: summary.failed > 0 ? `Не удалось обработать: ${summary.failed}` : undefined,
      });
    } else if (summary.skipped > 0) {
      toast.info("Трек уже находится в медиатеке", { id: "import-feedback" });
    }
    clearImportSummaryAction();
  }, [summary]);
  return (
    <div className="button-group">
      <Button onClick={wrap(importDirectoryAction)} disabled={loading}>
        {loading ? <LoaderCircle className="spin" /> : <FolderPlus />} Добавить папку
      </Button>
      <Button variant="secondary" onClick={wrap(importFilesAction)} disabled={loading}>
        <FileAudio /> Выбрать файлы
      </Button>
    </div>
  );
}, "ImportButtons");
