import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this as a project site at /<repo-name>/, so asset
  // and route references need that prefix baked in. Only the dedicated
  // "pages" build mode opts into it — the default `npm run build` (used by
  // any other host expecting root-relative paths) is unaffected.
  base: mode === "pages" ? "/stage-manager-sim/" : "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The static game content (real artists, gear, venues, historical firms and people) in its
        // own chunk, loaded with the game: it changes on its own schedule and keeps the code chunk lean.
        manualChunks: (id: string) => (id.includes("/src/world/content/") ? "content" : undefined),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
