import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // framer-motion is imported eagerly by the always-mounted game
          // shell (HUD/day-summary ceremony), so it would otherwise inflate
          // the main entry chunk. Forcing its own chunk keeps the entry
          // chunk under the bundle budget and lets browsers cache this
          // separately from app code that changes far more often.
          "vendor-framer-motion": ["framer-motion"],
        },
      },
    },
  },
}));
