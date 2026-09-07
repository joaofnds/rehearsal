import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { RunHistoryPage } from "#client/run-history/run-history-page";
import { SystemPage } from "#client/system/system-page";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
});

const runHistoryRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: RunHistoryPage,
});

const systemRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/system",
	component: SystemPage,
});

const routeTree = rootRoute.addChildren([runHistoryRoute, systemRoute]);

export interface CreateAppRouterOptions {
	readonly history?: RouterHistory | undefined;
}

export function createAppRouter(
	options?: CreateAppRouterOptions,
): ReturnType<typeof createRouter<typeof routeTree>> {
	return options?.history === undefined
		? createRouter({ routeTree })
		: createRouter({ routeTree, history: options.history });
}
