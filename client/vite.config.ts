import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: "client",
	plugins: [react()],
	resolve: {
		alias: {
			"#client": fileURLToPath(new URL("src", import.meta.url)),
		},
	},
});
