import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
import { LibraryPage } from "@/pages/library";
import { FavoritesPage } from "@/pages/favorites";
import { RecentPage } from "@/pages/recent";
import { PlaylistPage } from "@/pages/playlist";
import { SettingsPage } from "@/pages/settings";
import { RootLayout } from "@/app/layout/root-layout.tsx";

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const libraryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/library", component: LibraryPage });
const favoritesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/favorites", component: FavoritesPage });
const recentRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recent", component: RecentPage });
const playlistRoute = createRoute({ getParentRoute: () => rootRoute, path: "/playlist/$playlistId", component: PlaylistPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
const routeTree = rootRoute.addChildren([indexRoute, libraryRoute, favoritesRoute, recentRoute, playlistRoute, settingsRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
