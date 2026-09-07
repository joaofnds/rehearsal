import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SystemPage } from "./system-page";
import "./globals.css";

const root = document.querySelector("#root");

if (root === null) {
	throw new Error("root element not found");
}

createRoot(root).render(
	<StrictMode>
		<SystemPage />
	</StrictMode>,
);
