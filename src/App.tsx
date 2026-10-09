import { lazy, Suspense } from "react";

const TycoonGame = lazy(() => import("./tycoon/TycoonGame"));

const App = () => (
  <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#10131a" }} />}>
    <TycoonGame />
  </Suspense>
);

export default App;
