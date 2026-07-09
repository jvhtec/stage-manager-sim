# Stage Manager Sim — Tycoon Game Plan (2026 Reboot)

This is the working plan for turning the current prototype into a proper tycoon game. It
supersedes `docs/implementation-plan.md` for prioritization: that document tracked a staged
build-out that added *systems*, but the project still lacks the things that make a tycoon game
a **game** — persistence, time pressure, meaningful failure, and a difficulty curve. This plan
is grounded in the code as it exists today, file by file.

---

## 1. Where the project actually stands

More was built than the commit history suggests. What exists and works today:

| System | Where | State |
|---|---|---|
| Central game state + actions | `src/contexts/GameContext.tsx` (1,500 lines) | Working. Crew/equipment assignment, accept/complete events, day advance, transactions, bankruptcy check |
| Contract generation | `src/lib/gameData.ts` | Working, **gigs only** — `generateEvent()` is only ever called with `'gig'` |
| Crew progression | `src/lib/crewProgression.ts` | Working. XP, levels, certifications, morale drift, fatigue/recovery locks |
| Equipment | `src/lib/equipment.ts` | Working. Owned inventory, condition/wear, maintenance timers, rentals |
| Crisis prompts | `src/lib/crisis.ts` | Working. Planning/execution prompts with choices, resolved at completion |
| AI competitors | `src/lib/competitors.ts` | Working. Bidding on open contracts, schedules, reputation feedback, market news |
| Finances | `src/lib/finance.ts`, `src/hooks/useFinancialSummary.ts` | Working. Ledger, categories, 30-day trends, overdraft/bankruptcy rules |
| Onboarding | `src/components/CompanyOnboardingDialog.tsx` | Working. Name, palette, specialization with real perk effects |
| UI | `src/pages/` (Dashboard, Calendar, EventDetail, Crew, Inventory, Finances) | Working, desktop-oriented, dark theme |

The build is clean (`npm run build`, `tsc -p tsconfig.app.json --noEmit` both pass).

### What's missing or broken — the honest list

These are the reasons it doesn't feel like a game yet, roughly in order of damage:

1. **No save/load.** The entire `GameState` lives in a single `useState` in `GameContext.tsx`.
   Refreshing the tab erases the company. This blocks everything else — nobody balances or
   playtests a game they can't come back to. *(Fixed in the first commit on this branch — see §4, Phase 0.)*
2. **Dates never matter.** Events never auto-start, and a `planned` event whose date passes
   just sits there forever. `'in-progress'` exists in the types but nothing ever sets it; the
   only path to `'failed'` is losing a bid to a competitor (`competitors.ts:276`). You can
   complete a show three weeks after (or before!) its date. There is no time pressure at all.
3. **Execution is a button.** `EventDetail.tsx` → `handleCompleteEvent()` computes
   `75 + crew skill bonus` and calls `completeEvent()`. The GDD's "live event phase" — the
   heart of the fantasy — doesn't exist in any form. Show day should be where preparation
   pays off or blows up.
4. **No difficulty curve.** Contract generation doesn't scale with reputation or company
   level. `Company.level` exists in the type and is never incremented. Day 1 and day 100
   offer the same gigs. Tours and festivals are in the type system, docs, and UI copy but
   are never generated.
5. **The economy has no pressure.** Payroll is only charged per completed event. No weekly
   wages, no warehouse rent, no insurance — so an idle company loses nothing, and "do
   nothing" is a viable strategy. Tycoon economies need a burn rate.
6. **Bankruptcy is a dead end, not a game over.** `isBankrupt` disables buttons and shows an
   alert telling you to "resolve finances," but there is no loan, no asset sale, no game-over
   screen, no restart. The fail state is a soft-lock.
7. **Sim is non-deterministic and untestable.** `Math.random()` is called directly throughout
   `gameData.ts`, `crisis.ts`, `competitors.ts`. The GDD calls for a deterministic simulation
   layer with seeds. There is also **zero test infrastructure** — no test script, no vitest.
8. **Game-time vs wall-clock confusion.** Transactions, bids, and news items are stamped with
   real `new Date()` instead of `gameState.currentDate` (e.g. `createTransaction` in
   `GameContext.tsx`). Advance 30 game days in one sitting and the entire ledger shows today's
   real date, which corrupts the 30-day financial trend chart.
9. **Dead weight.** `three`, `@react-three/fiber`, `@react-three/drei` are in `package.json`
   but imported nowhere. The Supabase client exists (`src/integrations/supabase/`) but nothing
   uses it. The GDD still says "Engine: Unity or Godot (TBD)" — obsolete; this is a React web
   game and that's fine.
10. **God-file risk.** `GameContext.tsx` at 1,500 lines mixes state shape, reducer-style
    mutations, and business rules. Every new system so far has grown it. It needs to become a
    pure reducer + engine modules before Phases 1–3 pile on.

---

## 2. Design north star

**One sentence:** *Run a live-production company from a van-and-two-speakers outfit to the
house that runs festivals — where every booked show is a bet you have to cover with people,
gear, and time.*

The loop the game must enforce (today it only suggests it):

```
   MARKET            PLANNING              SHOW DAY             AFTERMATH
  contracts   →   staff + gear + fix  →  timed execution   →   money, rep, wear,
  appear &        planning crises        with incidents        XP, unlocked tiers
  expire ↑                                                          ↓
     └──────────────── reputation gates better contracts ───────────┘
```

Three rules every phase below serves:

- **Time is the antagonist.** Contracts expire, shows start whether you're ready or not,
  crew need rest, gear needs maintenance windows. The "Next Day" button should always feel
  slightly dangerous.
- **Preparation is the gameplay.** Show-day outcomes must be a function of decisions made in
  planning (staffing quality, gear condition, crisis mitigation) plus bounded randomness —
  never a flat formula.
- **Failure is survivable but expensive.** Missed shows, blown riders, and bankruptcy have
  teeth, and there are recovery levers (loans, asset sales, cheap gigs) so a bad week is a
  story, not a soft-lock.

---

## 3. Explicit cuts (decide now, stop carrying them)

- **Cut Supabase for now.** Saves are localStorage (versioned, see Phase 0). Cloud saves /
  auth are a post-1.0 idea. Remove the dependency or leave it dormant, but stop designing
  around it.
- **Cut the isometric 3D venue view.** The GDD's isometric visualization is why three.js was
  installed. Show day will be a 2D timeline/HUD (Phase 1). Drop the three deps; reintroduce
  only if the 2D show screen proves insufficient.
- **Retire "Unity or Godot" from the GDD.** The engine is React + TypeScript.
- **Challenge scenarios, multiplayer, modding, weather** — out of scope until after v1.0.

---

## 4. The phased plan

Each phase is shippable and playable on its own. Don't start a phase until the previous
one's exit criteria pass.

### Phase 0 — Foundations (make it a persistent, testable artifact)

The unglamorous work everything else stands on.

1. **Save/load** *(done in the first commit on this branch)*:
   versioned localStorage autosave of `GameState` on every change, restore on boot, ISO-date
   revival, "New Game" reset. Old/incompatible save versions are discarded rather than
   half-loaded.
2. **Extract the engine from React.** Convert `GameContext.tsx` into:
   - `src/engine/state.ts` — `GameState` factory + save serialization (schema version lives here)
   - `src/engine/reducer.ts` — pure `(state, action) => state` covering every mutation the
     context does today (assign/unassign, accept, complete, advanceDay, crisis response, …)
   - `src/engine/` modules absorb `lib/gameData.ts`, `lib/crisis.ts`, `lib/competitors.ts` rules
   - `GameContext.tsx` shrinks to `useReducer` + convenience callbacks. UI behavior unchanged.
3. **Seeded RNG.** Single `Rng` instance (mulberry32 or similar) threaded through the engine;
   seed stored in `GameState`. `Math.random()` becomes forbidden in `src/engine/**` (ESLint
   `no-restricted-properties`). This is what makes outcomes reproducible and testable.
4. **Game-clock everywhere.** Every transaction, bid, news item, and snapshot is stamped with
   sim time (`state.currentDate`), never `new Date()`. Fixes the ledger/trend-chart corruption.
5. **Test harness.** Add vitest + a `test` script. First tests are engine round-trips:
   - save → load → deep-equal state (dates included)
   - a scripted 30-day playthrough with a fixed seed reaches the same balance every run
   - completeEvent math (payroll, crisis deltas, wear) against hand-computed values
6. **Dependency cleanup.** Remove `three`, `@react-three/*`; decide Supabase (recommend:
   remove `src/integrations/supabase/` + dependency until cloud saves are real).

**Exit criteria:** refresh mid-game and nothing is lost; `npm test` runs green in CI-able
fashion; a fixed seed replays identically; `GameContext.tsx` < 300 lines.

### Phase 1 — Make time and show day real (the game part)

This is the phase that changes the genre from "dashboard" to "tycoon."

1. **Event lifecycle driven by the calendar.** On `advanceDay`:
   - `available` contracts past `acceptBy` expire (competitor picks them up, market news).
   - `planned` events whose date arrives become `in-progress` automatically.
   - A `planned` event whose date passes unresolved becomes `failed`: contract penalty
     (30–50% of `clientPay`), reputation hit, angry market news. Missing a show must hurt.
2. **Show-day resolution screen.** Replace the "Complete Event" button with a show-day flow
   (new route `/event/:id/show`). Minimum viable version — no animation needed:
   - The show plays out as a sequence of phases (load-in → soundcheck → doors → show →
     teardown) on a step/auto-advance timeline.
   - Each phase rolls incidents from the existing crisis library (`crisis.ts` execution
     prompts move here), weighted by *preparation quality*: understaffing, low-skill crew in
     the lead slot, gear condition < 60, unresolved planning crises all raise incident odds.
   - Incidents present the existing choice UI, but now mid-show with a time cost, and crew
     stats influence which options exist ("Calm Under Pressure" tech can cover a failure).
   - Satisfaction is *accumulated* across phases instead of `75 + bonus`. The formula lives
     in the engine and is unit-tested.
3. **Difficulty and progression curve.**
   - Contract generation scales with reputation: pay, requirement counts, venue tier, and
     crisis intensity all derive from rep bands (0–25 bar gigs → 75+ arena shows).
   - Make `Company.level` real: derive it from reputation milestones, use it to gate
     equipment tiers and (later) tours/festivals. Surface "next unlock at rep X" in the UI.
4. **Economic pressure.** Weekly payroll for the standing roster (not just per-event),
   monthly warehouse rent scaled to owned inventory. Add one recovery lever: a bank loan
   (principal + daily interest as ledger entries) so bankruptcy becomes avoidable-by-choice.
5. **Real game over + restart.** If bankruptcy sticks (credit limit breached N days), show a
   run-summary screen (days survived, shows played, peak balance/rep) with "Start New
   Company" wired to the Phase 0 reset.

**Exit criteria:** it is possible to *lose*; skipping "Next Day" forever is not viable;
two players with different prep get visibly different show outcomes; a full
session (new game → several shows → game over or thriving) works without a refresh.

### Phase 2 — Depth: roster, gear, and market as strategic layers

1. **Hiring market.** Replace instant-hire with a rotating weekly candidate pool (seeded RNG),
   signing bonuses, and rate negotiation influenced by reputation. Firing has severance +
   morale splash on the rest of the roster.
2. **Equipment ownership arc.** Buy/sell owned gear (marketplace tab in Inventory with
   tiered catalogs gated by company level), depreciation on sale price, insurance opt-in
   that softens crisis damage costs.
3. **Training & traits.** Spend money + days to train crew (skill, cross-department certs).
   Add 4–6 personality traits that hook into show-day incident options (the GDD's "Calm Under
   Pressure" idea) — traits are where crew stop being interchangeable stat blocks.
4. **Smarter competitors.** Competitors gain/lose reputation from their own simulated shows
   (already partially in `competitors.ts`), occasionally poach your idle high-skill crew, and
   react to your pricing. Add a simple standings/rivals screen built on the existing
   `reputationHistory`.
5. **Balance pass #1.** With the seeded engine + tests, script 90-day autoplay runs at three
   strategy profiles (conservative/aggressive/idle) and tune so idle dies, conservative
   survives, aggressive swings.

**Exit criteria:** distinct viable strategies exist (own vs rent, big roster vs lean +
rentals); crew feel individual; autoplay balance harness runs in CI.

### Phase 3 — Tours & festivals (the content ceiling)

Only start once single-gig play is genuinely fun — these multiply existing systems, they
don't fix them.

1. **Tours** = contract chains: 3–8 linked gigs, shared crew roster locked for the duration,
   travel days between stops consuming availability (the recovery-lock plumbing in
   `getCrewRecoveryDays`/`availableOn` already supports this), one consolidated payout with
   a completion bonus — abandoning mid-tour forfeits it and craters reputation.
2. **Festivals** = parallel gigs: one date, 2–4 stages, each stage a requirements block,
   shared equipment pool across stages (forces the own-vs-rent decision hard), one aggregate
   satisfaction score. Reuses the show-day engine with concurrent incident streams.
3. **Calendar upgrade.** The current `Calendar.tsx` list becomes a real month grid with
   multi-day spans, travel indicators, and conflict warnings — this is the screen where
   tour/festival trade-offs get made.
4. Gate both behind company level (e.g. tours at level 3, festivals at level 5) so they land
   as *earned* content.

**Exit criteria:** a tour can be booked, staffed, toured, and paid out; a 3-stage festival is
survivable only with deliberate gear strategy; both are unlockables, not day-1 noise.

### Phase 4 — Polish & release

- Sound design (UI feedback, show-day ambience) and micro-animation on money/rep changes —
  tycoon "juice."
- Tutorial-as-first-contract: scripted first gig that walks through staffing → gear →
  crisis → show day, replacing tooltip soup.
- Sandbox mode (unlimited funds toggle at new-game time — trivial once `createNewGameState`
  takes options).
- Code-split routes (`React.lazy`) — the bundle is already 917 KB and Phase 1–3 will grow it.
- Accessibility pass: the dark theme is currently hardcoded (`<div className="dark">` in
  `App.tsx`); add light theme + colorblind-safe department palette.
- Autosave slots (rotate 3 latest saves) + export/import save as JSON.

---

## 5. Engineering ground rules for this repo (going forward)

- **Engine is pure.** Nothing in `src/engine/**` imports React, touches `Date.now()`,
  `Math.random()`, or `localStorage`. All inputs come in as arguments (state, action, rng).
- **Every new mechanic lands with a test.** The seeded RNG makes this cheap; there is no
  excuse after Phase 0.
- **Schema version bumps on every `GameState` shape change**, with either a migration or a
  deliberate "discard old saves" decision noted in the PR.
- **The docs in `docs/sector-pro-simulator-*.md` are vision documents**, not status. Status
  and sequencing live here. Update this file's checkboxes per PR instead of appending
  "✅ Implemented" lines to the GDD.

## 6. Suggested first three PRs

1. **Persistence + New Game** *(this branch)* — autosave/restore/reset. Small, immediately
   felt, unblocks playtesting.
2. **Engine extraction + seeded RNG + vitest** — pure refactor, no behavior change, locked in
   by the first round-trip and replay tests.
3. **Event lifecycle + missed-show penalties** — the first real *game rule*, and the smallest
   slice of Phase 1 that creates time pressure.

After that, Phase 1's show-day screen is the big rock, and everything else follows the order
above.
