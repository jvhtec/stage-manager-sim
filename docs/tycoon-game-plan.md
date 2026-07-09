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
2. **Extract the engine from React** *(done, with one deliberate deviation)*. `src/engine/`
   now holds:
   - `state.ts` — `GameState` factory + save serialization (schema version lives here)
   - `crewActions.ts`, `equipmentActions.ts`, `eventActions.ts`, `crisisActions.ts`,
     `companyActions.ts`, `dayActions.ts` — every mutation `GameContext.tsx` used to do inline
     inside a `setGameState(prev => {...})` callback is now a standalone exported function
     shaped `(state: GameState, ...args) => GameState` (or `{ state, result }` for the ~6
     actions that report a result back to the caller — assign/rent/maintenance/crisis-response
     all return `{success, reason?}`-shaped results the UI reads synchronously for toasts).
   - **Deviation from the original plan text**: no literal `useReducer`/discriminated
     action-type union. `GameContext.tsx` (1,626 → ~250 lines) keeps `useState` and calls these
     functions directly inside the same `setGameState(prev => ...)` pattern it always used —
     each wrapper is now 3-5 lines instead of 20-230. This achieves every stated goal (pure,
     testable, no React in the engine, `GameContext.tsx` shrinks to thin orchestration) without
     inventing an out-of-band mechanism for actions that need to return a value synchronously,
     which a raw reducer can't do without extra machinery. If a real reason to formalize
     dispatch/action-types shows up later (undo/redo, action logging), revisit then.
   - `src/lib/**` keeps the domain rule modules (`gameData.ts`, `crisis.ts`, `competitors.ts`,
     `equipment.ts`, `crewProgression.ts`, `finance.ts`) — `src/engine/` calls into them. No
     `lib/` → `engine/` rename; that's still cosmetic churn for zero behavior change.
   - Verified with 43 tests (`src/engine/__tests__/*`, plus the existing `src/lib/__tests__/*`)
     and a full-surface browser smoke test exercising every single action in the app
     (onboarding, staffing, accept, rent, maintenance, hire, day-advance, crisis response,
     show-day completion, new-game reset) with zero console errors.
   - Bonus find from writing these tests: `generateCrewMember`'s `availableOn` used wall-clock
     `new Date()` instead of game time — the same bug class already fixed for transactions.
     Fixed by threading `currentDate` through `generateCrewMember`/`generateInitialCrew`.
3. **Seeded RNG** *(done)*. `src/lib/rng.ts`'s `createRng(seed)` (mulberry32) is threaded
   through every *automatic* simulation surface: initial game boot (starting crew, contracts,
   competitors) and `advanceDay`'s cascade (new-contract rolls, event terms, crew morale
   drift, competitor bidding/schedule progression). `GameState.rngState` persists the current
   generator state so a saved-and-reloaded game continues the same sequence rather than
   reseeding. Proven in `src/lib/__tests__/determinism.test.ts`: same seed → byte-identical
   (minus ids) events/crew/competitors, and a simulated multi-step "day" replays exactly.
   Deliberately left un-seeded: entity id suffixes (uniqueness only, not a gameplay outcome —
   still plain `Date.now() + Math.random()`), and `Crew.tsx`'s manual "hire a candidate"
   button (a one-off UI action outside the day-tick loop, given its own local
   `createRng(Date.now())`). The `no-restricted-properties` ESLint rule forbidding
   `Math.random()` outright isn't added yet — doing so now would also need to flag those two
   intentional exceptions, so it's left for whoever does item 2 above and can decide the
   final file boundary at the same time.
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

1. **Event lifecycle driven by the calendar** *(done)*. `src/lib/gameData.ts`'s
   `applyEventLifecycle()`, wired into `advanceDay`:
   - `available` contracts with no active bid past `acceptBy` expire (`failed`, info-tone
     market news) — previously an unclaimed contract sat as `available` forever.
   - `planned` events flip to `in-progress` automatically once their date arrives.
   - A show left unresolved 1 day past teardown auto-fails: 35% of `clientPay` charged as a
     cancellation penalty (correctly game-time-stamped — see below), a 6-point reputation
     hit, warning-tone market news, and its crew/gear are released back to the pool.
   - Fixed alongside it: every transaction (`createTransaction` in `GameContext.tsx`) was
     stamped with real wall-clock `new Date()` instead of `gameState.currentDate` — this
     silently corrupted the 30-day financial trend chart whenever you fast-forwarded days.
     Now takes the game date explicitly.
   - Calendar gained "In Progress" and "Failed" tabs — both states were previously invisible
     in the UI (a `planned` event that flipped status simply vanished from every list).
   - Covered by `src/lib/__tests__/eventLifecycle.test.ts` (8 cases: expiry, in-progress
     transition, grace-deadline auto-fail + penalty math + crew/gear release, and the
     do-nothing paths). First vitest harness in the repo (`npm test` / `npm run test:run`).
2. **Show-day resolution screen** *(mostly done)*. `/event/:id/show` (`src/pages/ShowDay.tsx`)
   replaces the old "Complete Event (Demo)" button:
   - `src/lib/showDay.ts`'s `calculatePreparationScore()` derives a 0-100 readiness score from
     assigned crew's average skill and fatigue and assigned gear's average condition — this
     is the "preparation quality" the plan called for. `getBaseSatisfactionFromPreparation()`
     maps it onto a 45-90 baseline, replacing the old flat `75 + crew bonus` that ignored prep
     entirely. Both are pure and unit-tested (`src/lib/__tests__/showDay.test.ts`).
   - Three phases — Load-In, Doors & Performance, Teardown — as a step timeline. Execution-
     stage crisis prompts (`worn-equipment`, `turnaround-risk`) were moved out of the pre-show
     "Risk & Crisis Preparation" panel (now planning-stage only) and now surface on their
     mapped phase (`getPhaseForCrisisPrompt()`); resolving them uses the same
     `respondToCrisisPrompt` action, just gated to the right moment instead of resolvable
     days in advance.
   - Still missing: an actual per-phase incident **roll**. Today a phase only shows an
     incident if the existing crisis generator already flagged one during planning (worn gear
     or a tight turnaround) — there's no randomized "something goes wrong live" event for the
     performance phase itself, and no crew traits ("Calm Under Pressure") influencing options.
     That's real content work for the crisis library (Phase 2's traits item is the natural
     home for it), not a wiring problem.
3. **Difficulty and progression curve** *(done for gigs; tours/festivals remain Phase 3)*.
   `src/lib/reputationTiers.ts` defines 4 bands calibrated around the 50-reputation starting
   point (Local Circuit 0-34, Regional Touring 35-59, National Headliner 60-84, World Class
   85-100), each with its own venue pool, pay multiplier (0.75x-2.4x), and — from tier 3
   up — an added crew requirement on top of the gig baseline (tiers 1-2 keep the exact
   original 2/1/1/2 requirement so a fresh company's first contracts never outgrow the
   starting 7-person roster).
   - `generateEvent()` now takes the company's reputation and picks venue/pay/requirements
     from the matching tier; `Event.venueTier` is fixed at generation time so a contract's
     stakes don't retroactively change if reputation later drifts.
   - Crisis intensity scales too: `generateCrisisPrompts()` multiplies `baseSatisfactionPenalty`
     / `baseFinancialPenalty` by the event's own `venueTier` multiplier (0.85x-1.45x) — bigger
     shows are harder to fully mitigate even with the best available choice, by design.
   - `Company.level` is real now (`syncCompanyLevel()`, called everywhere reputation changes:
     `completeEvent`, `advanceDay`'s lifecycle delta, `completeCompanyOnboarding`'s balanced
     bonus) and surfaced in the UI: a "Level N · Tier Label" badge plus a "X more reputation to
     Y" hint on the Dashboard, and a venue-tier badge on `EventDetail`.
   - Verified in a real browser: boosting reputation to 90 correctly generated tier-4
     contracts (Skydome Stadium, $6,249) with the tier-3+ requirement bonus visibly applied
     (Audio 0/4 instead of the baseline 0/2), and the level badge tracked a reputation dip
     from an unrelated missed show mid-test — the systems compose correctly together.
   - **Regression caught and fixed along the way**: the engine extraction two commits prior
     had silently dropped `acceptEvent`'s `rebuildEventCrises` call. Crises are only ever
     generated for `planned`/`in-progress` events, and `acceptEvent` is the only place that
     makes that transition — so no accepted show got a crisis prompt (not even the always-on
     "spot check" fallback) until the next `advanceDay`, which separately calls
     `rebuildAllPlannedCrises` and papered over the gap. That's exactly why it slipped past
     the extraction's own browser verification: every prior smoke test advanced several days
     between accepting and reaching Show Day. Fixed, with a regression test
     (`eventActions.test.ts`) and a browser check of the specific window (immediately after
     accept, before any day advances).
4. **Economic pressure** *(done)*. `src/lib/economy.ts`'s `calculateStandingCosts()`, applied
   every `advanceDay`:
   - Weekly (every 7 days) crew retainer — `hourlyRate × 6h` per crew member, charged whether
     or not they worked a show. Deliberately *not* a full 40h/week wage: this industry's crew
     are freelance, and a full salaried model would bankrupt a fresh $15k-balance company
     within two weeks doing nothing wrong. Verified against the starting roster: ~$1,890/week,
     ~$7,560 over an idle month — real pressure, not an instant trap.
   - Monthly (every 30 days) warehouse overhead — a base fee plus a per-owned-item charge.
   - **Bank loan lever** (`src/engine/loanActions.ts`, `takeLoan`/`repayLoan`, wired into the
     Finances page): principal capped by a reputation-scaled credit limit
     (`calculateMaxLoanAmount`), 1%/day interest charged as its own ledger transaction and
     added to the principal. This is the "avoidable by choice" escape hatch the plan called
     for — it replaces a placeholder "Emergency Loan (+$5,000)" button that was literally free
     money with no debt tracking at all.
5. **Real game over + restart** *(done)*. Bankruptcy no longer freezes `advanceDay` — bills
   still land, and `completeEvent` is deliberately *not* blocked by `isBankrupt` (finishing an
   already-staffed show to collect payment is one of the few ways out; blocking it made the
   old soft-lock worse). `GameState.bankruptStreak` counts consecutive bankrupt days; at
   `GAME_OVER_BANKRUPT_STREAK_DAYS` (5) a real `isGameOver: true` triggers, with a
   `RunSummary` (days survived, shows completed, peak balance/reputation) computed once from
   the transaction ledger. `GameOverDialog` (new component, same blocking-modal pattern as
   onboarding) shows the summary and wires "Start a New Company" to the existing reset. The
   Dashboard's "Next Day" button only disables on `isGameOver` now, not `isBankrupt`.

**Exit criteria met**: it is possible to *lose* — verified end-to-end in a real browser
(forced bankruptcy → `bankruptStreak` climbs → `GameOverDialog` appears with a correct
summary → "Start a New Company" resets cleanly); skipping "Next Day" forever is no longer
free (weekly retainer bites); a full session (new game → idle days → loan → repayment →
bankruptcy → game over → restart) works without a refresh, zero console errors across 5
screenshots. The "two players with different prep get visibly different show outcomes" half
of this exit criteria was already satisfied by the show-day preparation score (Phase 1 §2).

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

1. ✅ **Persistence + New Game** *(done)* — autosave/restore/reset.
2. ✅ **Seeded RNG** *(done)* — see Phase 0 §3 above. vitest itself landed with this PR too.
3. ✅ **Event lifecycle + missed-show penalties** *(done)* — see Phase 1 §1 above.
4. ✅ **Show-day resolution screen** *(mostly done)* — see Phase 1 §2 above. The remaining
   piece (randomized live-show incidents, crew traits) is crisis-library content work, not
   plumbing.
5. ✅ **Engine extraction** *(done, with one deliberate deviation)* — see Phase 0 §2 above.
   `GameContext.tsx` is down to ~250 lines; every mutation lives in `src/engine/**` as a pure,
   tested function.
6. ✅ **Economic pressure + real game over** *(done)* — see Phase 1 §4-5 above. Weekly
   retainer, monthly overhead, a real bank loan, and bankruptcy that ends in an actual
   game-over screen instead of a frozen dashboard.
7. ✅ **Difficulty and progression curve** *(done)* — see Phase 1 §3 above. Reputation now
   gates venue, pay, and requirements for gigs, `Company.level` is real, and crisis stakes
   scale with the tier a show was booked at.

**Every item from Phase 0 and Phase 1 is now done** (tours/festivals stay deferred to Phase 3,
as originally scoped — they were never meant to land here). Day 100 finally looks different
from day 1: better reputation unlocks bigger venues, bigger pay, harder requirements, and
higher-stakes crises; an idle company bleeds cash; bankruptcy either resolves through a loan
or a finished show, or ends the run for real. Phase 2 (hiring market, gear marketplace, crew
traits) is the natural next place to spend effort — the core loop this plan set out to fix is
complete.
