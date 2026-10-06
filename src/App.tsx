import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider } from "./contexts/GameContext";
import { GameShell } from "./components/shell/GameShell";

// The Transport-Tycoon-style map game is the main experience; the original
// dashboard-driven build lives on at /classic (its own router basename, so
// none of its absolute links needed to change).
const TycoonGame = lazy(() => import("./tycoon/TycoonGame"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calendar = lazy(() => import("./pages/Calendar"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const ShowDay = lazy(() => import("./pages/ShowDay"));
const Crew = lazy(() => import("./pages/Crew"));
const Finances = lazy(() => import("./pages/Finances"));
const Inventory = lazy(() => import("./pages/Inventory"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
const CLASSIC_BASE = `${import.meta.env.BASE_URL}classic`;

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

const ClassicApp = () => (
  <QueryClientProvider client={queryClient}>
    <GameProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={CLASSIC_BASE}>
          <GameShell>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/event/:id/show" element={<ShowDay />} />
                <Route path="/crew" element={<Crew />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/finances" element={<Finances />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </GameShell>
        </BrowserRouter>
      </TooltipProvider>
    </GameProvider>
  </QueryClientProvider>
);

const App = () => {
  const isClassic = window.location.pathname.startsWith(CLASSIC_BASE);
  if (isClassic) return <ClassicApp />;
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#10131a" }} />}>
      <TycoonGame />
    </Suspense>
  );
};

export default App;
