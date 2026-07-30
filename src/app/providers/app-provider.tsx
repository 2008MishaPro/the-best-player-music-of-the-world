import { useEffect, type ReactNode } from "react";
import { reatomComponent, useAction } from "@reatom/react";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { loadEqualizerAction } from "@/entities/equalizer";
import { loadPlaylistsAction } from "@/entities/playlist";
import { displayedThemeAtom, loadThemeAction } from "@/entities/theme";
import { checkMissingAction, loadTracksAction } from "@/entities/track";
import { initializePlaybackAction } from "@/features/control-playback";
import { loadQueueAction } from "@/features/manage-playback-queue";
import { initializeAnalysisEventsAction } from "@/features/start-track-analysis";
import { router } from "@/app/routes/router.tsx";

function Bootstrap({ children }: { children: ReactNode }) {
  const initialize = useAction(async () => {
    await loadThemeAction().catch(() => undefined);
    await Promise.all([
      loadTracksAction(),
      loadPlaylistsAction(),
      loadQueueAction(),
      loadEqualizerAction(),
    ]);
    void checkMissingAction();
    return Promise.all([initializePlaybackAction(), initializeAnalysisEventsAction()]);
  });

  useEffect(() => {
    let cleanups: Array<() => void> = [];
    void initialize().then((subscriptions) => {
      cleanups = subscriptions;
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [initialize]);
  return children;
}

export const AppProvider = reatomComponent(() => {
  const theme = displayedThemeAtom();
  return (
    <Bootstrap>
      <RouterProvider router={router} />
      <Toaster theme={theme.seed.mode} richColors />
    </Bootstrap>
  );
}, "AppProvider");
