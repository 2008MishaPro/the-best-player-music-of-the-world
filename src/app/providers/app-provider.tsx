import { useEffect, type ReactNode } from "react";
import { useAction } from "@reatom/react";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { loadPlaylistsAction } from "@/entities/playlist";
import { checkMissingAction, loadTracksAction } from "@/entities/track";
import { initializePlaybackAction } from "@/features/control-playback";
import { loadQueueAction } from "@/features/manage-playback-queue";
import { initializeAnalysisEventsAction } from "@/features/start-track-analysis";
import { router } from "@/app/routes/router.tsx";

function Bootstrap({ children }: { children: ReactNode }) {
  const initialize = useAction(async () => {
    await Promise.all([loadTracksAction(), loadPlaylistsAction(), loadQueueAction()]);
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

export function AppProvider() {
  return <Bootstrap><RouterProvider router={router} /><Toaster theme="dark" richColors /></Bootstrap>;
}
