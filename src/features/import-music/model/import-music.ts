import { action, atom } from "@reatom/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ImportSummary } from "@/entities/track";
import { libraryApi, loadTracksAction } from "@/entities/track";

export const importLoadingAtom = atom(false, "importLoadingAtom");
export const importSummaryAtom = atom<ImportSummary | null>(null, "importSummaryAtom");
export const importErrorAtom = atom<string | null>(null, "importErrorAtom");

export const clearImportSummaryAction = action(() => {
  importSummaryAtom.set(null);
}, "clearImportSummaryAction");

export const clearImportErrorAction = action(() => {
  importErrorAtom.set(null);
}, "clearImportErrorAction");

const audioFilters = [{ name: "Аудиофайлы", extensions: ["mp3", "flac", "wav"] }];

async function executeImport(run: () => Promise<ImportSummary>) {
  importLoadingAtom.set(true);
  importErrorAtom.set(null);
  importSummaryAtom.set(null);
  try {
    const summary = await run();
    importSummaryAtom.set(summary);
    await loadTracksAction();
    if (summary.failed > 0 && summary.imported + summary.updated === 0) {
      importErrorAtom.set(summary.errors[0] ?? "Не удалось импортировать выбранные файлы");
    }
  } catch (error) {
    importErrorAtom.set(error instanceof Error ? error.message : String(error));
  } finally {
    importLoadingAtom.set(false);
  }
}

export const importFilesAction = action(async () => {
  const selected = await open({ multiple: true, directory: false, filters: audioFilters });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  await executeImport(() => libraryApi.importFiles(paths));
}, "importFilesAction");

export const importDirectoryAction = action(async () => {
  const selected = await open({ multiple: false, directory: true });
  if (!selected || Array.isArray(selected)) return;
  await executeImport(() => libraryApi.importDirectory(selected));
}, "importDirectoryAction");
