import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/widgets/sidebar";
import { PlayerBar } from "@/widgets/player-bar";
import { PlaybackQueuePanel } from "@/widgets/playback-queue";

export function RootLayout() {
  return <div className="app-shell"><Sidebar /><main className="app-content"><Outlet /></main><PlaybackQueuePanel /><PlayerBar /></div>;
}
