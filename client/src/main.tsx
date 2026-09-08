import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "#client/query-client";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "./router";
import "./system/globals.css";

const root = document.querySelector("#root");

if (root === null) {
	throw new Error("root element not found");
}

const queryClient = createQueryClient();
const router = createAppRouter();

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
