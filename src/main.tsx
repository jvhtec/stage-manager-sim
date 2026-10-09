import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// The old dashboard build kept its own save; nothing reads it any more.
try {
  localStorage.removeItem("stage-manager-sim:save");
} catch {
  // Storage blocked — nothing to clean up.
}

// Installable, offline-capable PWA. Only in production builds — a service
// worker caching the dev server's modules would fight Vite's HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Offline support is a nicety; the game runs fine without it.
    });
  });
}
