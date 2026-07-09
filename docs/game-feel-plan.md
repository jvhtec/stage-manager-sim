# Stage Manager Sim — Game Feel Plan (Graphics & Mechanics Overhaul)

Companion to `docs/tycoon-game-plan.md`. That plan fixed the *simulation* — persistence,
time pressure, economy, difficulty, a hiring market — and every Phase 0/1 item plus the
Phase 2 hiring market has shipped. The feedback on the deployed build is blunt and correct:
**it still doesn't feel like a game.** It feels like an admin dashboard that happens to
track a fictional company.

This plan is about closing that gap. It is grounded in the code as it exists on `main`
today, file by file, and sequenced into PR-sized chunks the same way the tycoon plan was.

---

## 1. Diagnosis — why it feels like a dashboard

Playing the deployed build, every reason is visible on screen:

1. **Every screen is a CRUD page.** `Dashboard.tsx` (744 lines), `Crew.tsx`, `Inventory.tsx`,
   `Finances.tsx`, `Calendar.tsx` are all the same shape: shadcn `Card` grids, `Tabs`, stat
   tiles, a back-arrow button to `/`. Navigation is page-swapping via react-router. There is
   no persistent game frame — money, date, and reputation are *page content*, not a HUD.
2. **The core verb is a form submit.** "Next Day" is a button in a card (`Dashboard.tsx:215`).
   Press it and numbers silently change. The most consequential action in the game — the one
   the tycoon plan calls "always slightly dangerous" — has zero ceremony, zero dramatization
   of what happened overnight.
3. **Show Day is a checklist, not a show.** `ShowDay.tsx` renders three phase headings, a
   list of crisis cards, and a "Complete" button. The heart of the fantasy — lights, PA
   stacks, a crowd — exists nowhere visually. Preparation score is a number in a badge.
4. **Nothing moves and nothing sounds.** The only motion in the app is shadcn's built-in
   dialog/toast transitions (`tailwindcss-animate`). Money changes are instant text swaps.
   There is no audio at all. Success and failure feel identical at the sensory level.
5. **No characters.** Crew are text cards (`CrewMemberCard.tsx`) — name, stars, two progress
   bars. Nothing to recognize or get attached to. Competitors are names in a news feed.
6. **No space.** Venues are strings (`'Skydome Stadium'`). Contracts are list rows. Travel
   hours are a number. The game has no *place*, so the company never feels situated in a
   living market.
7. **No goals beyond survival.** There are no milestones, no objectives, no achievements —
   the only long-term structure is the reputation tier ladder, and it's communicated as a
   badge label.

None of this is a criticism of the sim layer. `src/engine/**` + `src/lib/**` are pure,
seeded, tested (82 tests), and cleanly separated from React — which is exactly what makes a
presentation overhaul tractable: **everything below is a view-layer and content project,
not a rewrite.**

## 2. Design pillars

1. **Show, don't administrate.** Every important number gets a visual, spatial, or animated
   representation. If a value changes and the screen doesn't visibly react, that's a bug.
2. **The stage is the star.** Show Day becomes an animated 2D scene — the screen where all
   planning decisions visibly pay off or blow up. Everything else in the game is preparation
   for this screen.
3. **Feedback is physical.** Money counts up/down with sound, reputation stars fill, crises
   shake the screen, success rains confetti. Cheap dopamine, deliberately.
4. **Assets are procedural, tiny, and local.** The game deploys to GitHub Pages as a static
   bundle. All art is inline SVG/Canvas drawn from code (seeded where it matters), all audio
   is WebAudio synthesis — no binary asset pipeline, no external requests, no bundle bloat.
5. **The engine stays pure.** The scene layer *reads* engine state and *renders* it. No
   gameplay logic ever lives in a component. New mechanics land engine-first with tests,
   same discipline as before.

## 3. The workstreams

### A. Game shell & HUD (the frame everything lives in)

Replace per-page headers and back-arrows with a persistent game chrome in `App.tsx`:

- **Top HUD bar**, always visible: animated cash counter (odometer-style digits, green/red
  delta flashes), reputation as a 5-star fill with tier label, company level badge, in-game
  date, and the company's brand color as the bar's accent. Data already exists on
  `gameState.company`; this is pure presentation.
- **Left dock navigation** (icon rail): Dashboard → HQ, Calendar, Crew, Inventory, Finances.
  Kills the back-button-to-home pattern entirely.
- **Bottom ticker**: `marketNews` becomes a scrolling news ticker instead of a card list —
  the world feels alive between days.
- **"End Day" ceremony**: the Next Day button moves into the HUD and triggers a full-screen
  day-transition overlay — night sweep, then a "while you slept" summary (new contracts,
  bills charged, competitor moves, morale events — all already computed by `advanceDay`,
  currently discarded silently). This single change does more for game feel per line of code
  than anything else in this plan: it dramatizes the existing sim.
- Route content renders inside the shell; pages lose their own `min-h-screen` wrappers and
  headers.

**Exit criteria:** no screen has a back button; money/date/rep visible at all times; ending
a day shows an overnight summary; `advanceDay`'s outputs are surfaced, not silent.

### B. Visual identity & characters

- **Design language pass** on the existing HSL token system in `index.css`: a display font
  for headings (self-hosted subset, or a styled system stack), noise/gradient backdrop
  instead of flat `--background`, tier-colored accents (Local Circuit through World Class
  each get a palette), glow treatments on interactive cards. Keep the dark theme as primary.
- **Procedural crew avatars**: an SVG avatar component seeded from `crew.id` (deterministic,
  matching the sim's seeded-rng philosophy) — face shape, skin/hair/accessory variations,
  department-colored gear (headphones for audio, gloves for stage…). Used in
  `CrewMemberCard`, hiring market, event rosters, and show-day incident prompts. This is
  what turns "stat block" into "person I hired."
- **Venue art**: one layered SVG scene per reputation tier (dive bar → club → arena →
  stadium), reused as `EventCard`/`EventDetail` headers and as the Show Day backdrop. Four
  illustrations cover every venue in `reputationTiers.ts`.
- **Equipment icons**: proper SVG glyphs per `EquipmentType` (PA stack, moving head, LED
  wall, deck, distro) replacing generic lucide icons.

**Exit criteria:** every crew member has a stable face; every event shows its venue; the
app no longer looks like stock shadcn.

### C. Show Day: the live scene (the big rock)

Rebuild `ShowDay.tsx` around an animated 2D stage scene (SVG + CSS/JS animation; canvas
only if SVG perf demands it):

- **The stage**: tier-appropriate venue backdrop (from B), PA stacks and monitors scaled to
  assigned audio gear, lighting rig with animated beams in the company's brand colors, LED
  wall shimmer if video gear is assigned, crowd rendered as layered silhouette rows.
- **State drives the picture**: preparation score sets the crowd's baseline energy (density,
  bounce amplitude); each assigned department visibly populates the stage; gear condition
  < 50 causes visible flicker/glitch effects on that department's elements. The
  `calculatePreparationScore` inputs stop being a number and become *the look of your show*.
- **Phases play out in time**: Load-In → Doors & Performance → Teardown run as short timed
  sequences (~20-30s each, always skippable) with a progress bar, crowd noise swelling at
  doors, and a live **satisfaction needle** that starts at `baseSatisfaction` and reacts to
  crisis outcomes in real time.
- **Incidents interrupt**: execution-stage crises (already generated and phase-mapped via
  `getPhaseForCrisisPrompt`) pop as timed choice cards over the scene — countdown ring, 2-3
  options, auto-resolves to the worst option if ignored. Crew avatars of the relevant
  department appear on the card. The existing `respondToCrisisPrompt` action is unchanged.
- **The payoff**: completion becomes a results sequence — crowd roar or boos, confetti at
  ≥85 satisfaction, then the existing post-event report restyled as an encore screen with
  count-up earnings and XP bars filling per crew member.

**Engine work required (small, tested):** a `showDayTick`-style pure helper that maps
elapsed phase time + resolved crises to a live satisfaction value, so the needle is
deterministic and unit-testable rather than component state. Everything else reads existing
state.

**Exit criteria:** someone watching over your shoulder recognizes a concert happening; two
players with different prep get *visibly* different shows (sparse dim stage + flat crowd vs
full rig + bouncing crowd); ignoring an incident on purpose visibly hurts.

### D. Juice: motion & sound

- **Motion**: add `framer-motion` (code-split; ~30KB gz — budgeted). Animated number
  component for all money/XP/rep displays; floating `+$2,400` / `-$300` deltas that drift
  and fade from the HUD when transactions land; card enter/exit and hover micro-motion;
  screen shake on high-severity crises; level-up and tier-up full-screen stingers; confetti
  burst component (tiny, hand-rolled canvas, no dependency).
- **Sound**: a small WebAudio module (`src/lib/audio/`) — synthesized, zero audio files:
  UI ticks, cash-register arpeggio on income, dull thud on expenses, rising sting for
  level-up, crowd noise as filtered noise buffers with intensity parameter (drives Show Day
  ambience), alarm blip for crises. Master volume + mute in a settings popover, persisted to
  localStorage (a UI preference, not `GameState` — no schema bump).
- **Rule**: every engine action with a financial or reputation consequence must have a
  sensory acknowledgement (motion, sound, or both).

**Exit criteria:** completing a show with sound on feels *good*; a muted screen-recording
of any 30 seconds of play visibly contains motion.

### E. The city map (making the market spatial)

Replace the "Available Contracts" list as the primary market view (list stays as a toggle):

- A stylized SVG **city map** — hand-authored layout, ~12 fixed venue locations tagged by
  tier (dive bars downtown, stadium on the edge). Available contracts appear as pulsing pins
  at their venue; pin size/glow = tier and pay.
- Hovering/tapping a pin opens the existing contract card; accepting animates a claim flag
  in company colors.
- **Competitor presence**: competitor-won contracts (`lostToCompetitorId`) show as pins in
  the rival's `brandColor` — you *see* Rhythm & Rigging eating the west side. Their HQ dots
  scale with reputation over time.
- `travelHours` on generated events derives from map distance instead of a random roll —
  the number finally means something (engine change, seeded, tested).
- Locked tiers render as grayed districts ("Reputation 60 unlocks Arena District") — the
  progression ladder becomes visible geography.

**Exit criteria:** a new player understands "bigger venues exist and I can't book them yet"
without reading any text; competitors visibly occupy space.

### F. Mechanics: goals, drama, and the missing content ceiling

Presentation makes it feel like a game; these give it a game's *spine*. All engine-first.

1. **Milestones & objectives** (`src/lib/milestones.ts` + `GameState.milestones`, schema
   bump): a fixed chain of ~20 goals (first show, first tier-3 show, $50k banked, full
   4-department roster, survive a 3-crisis show, beat a competitor's bid…) each with a cash
   or reputation reward. Surfaced as a HUD tracker showing the next 3. This gives every
   session a "what am I working toward" answer.
2. **Tutorial-as-first-contract**: new games start with a scripted, un-loseable first gig
   that walks staffing → gear → crisis → the new Show Day scene, replacing the current
   cold-start wall of cards. (Was Phase 4 in the tycoon plan; pulled forward because the new
   presentation is only learnable if something teaches the loop.)
3. **Daily events**: a seeded chance per day of an opportunity or setback — rush contract
   (accept by tomorrow, +40% pay), gear breakdown, crew poaching attempt (counter-offer or
   lose them), viral review (+rep). Rendered as cards in the End Day summary (A). Makes the
   Next Day button a genuine gamble instead of a timer tick. Engine: `src/lib/dailyEvents.ts`,
   rolled inside `advanceDay` with the existing rng.
4. **Tours & festivals** (unchanged scope from tycoon plan Phase 3, but now landing on top
   of the scene/map presentation): tours as contract chains drawn as routes on the city map;
   festivals as multi-stage shows reusing the Show Day scene with parallel incident streams.
   Still gated behind company level 3/5.
5. **Sandbox & difficulty** at new game: starting-balance/burn-rate presets (Easy/Standard/
   Brutal) + unlimited-funds sandbox toggle — trivial once `createNewGameState` takes
   options, and it makes the game demoable.

### G. Engineering guardrails (non-negotiable while doing A-F)

- **Code-split now**: `React.lazy` every route + separate chunks for the scene and
  framer-motion. The bundle is already 952KB/277KB gz; the CI budget check should land in
  the first PR of this plan, not the last.
- **Engine purity holds**: scene/audio/juice layers never mutate state and contain no rules.
  New mechanics (milestones, daily events, travel-from-distance) land in `src/engine/**` /
  `src/lib/**` with tests before any pixels.
- **Determinism holds**: avatars and any generated art seed from entity ids; gameplay rolls
  keep using `GameState.rngState`. Cosmetic-only animation may use `Math.random()` freely
  (document the boundary in `rng.ts`).
- **Every PR ships playable** and gets the usual browser verification with screenshots at
  desktop + a mobile-width spot check.

## 4. Sequencing — PR-sized chunks in order

| # | PR | Contents | Why this order |
|---|----|----------|----------------|
| 1 | ✅ **Shell + HUD + code-split** *(done)* | Workstream A, route lazy-loading, bundle budget in CI | The frame everything else mounts into; biggest feel-win per line |
| 2 | ✅ **Juice foundation** *(done)* | framer-motion, animated numbers, transaction deltas, day-transition ceremony polish | Makes the sim's existing outputs *felt*; shell (1) provides the mount points |
| 3 | ✅ **Identity + avatars + venue art** *(done)* | Workstream B | Pure content; unblocks the scene (needs venue backdrops + avatars) |
| 4 | **Show Day scene v1** | Workstream C: stage, crowd, phases, incidents-over-scene, results sequence | The centerpiece; depends on 2 + 3 |
| 5 | **Sound** | Workstream D audio module, wired into HUD + scene | Scene exists to score; independent of 6-8 |
| 6 | **City map** | Workstream E incl. travel-from-distance engine change | Big but isolated; makes market + competitors spatial |
| 7 | **Milestones + tutorial contract** | F1 + F2 | Gives the polished loop a spine for new players |
| 8 | **Daily events** | F3 | Cheap once the End Day summary (1) exists |
| 9+ | **Tours, then festivals** | F4, one PR each | The content ceiling, landing on finished presentation |
| 10 | **Difficulty + sandbox** | F5 | Trivial closer; good "1.0" marker |

Each PR keeps the tycoon plan's rules: engine changes tested, schema bumps versioned,
browser-verified with screenshots, tracker updated in this file.

### PR 1 status — Shell + HUD + code-split (done)

- **HUD** (`src/components/shell/GameShell.tsx`): sticky top bar with brand-colored accent
  border, count-up cash display (`src/hooks/useCountUp.ts` — RAF tween, no new dependency),
  a 5-star reputation meter that fills proportionally within each 20-point band (not a
  snap), level/tier label, in-game date, and the Next Day / New Game actions (moved out of
  `Dashboard.tsx`, which previously owned both).
- **Nav rail**: persistent left icon column (HQ/Calendar/Crew/Inventory/Finances) replaces
  every top-level page's own "arrow back to /" button. `Calendar.tsx`, `Crew.tsx`,
  `Inventory.tsx`, `Finances.tsx` all lost their redundant header row and `min-h-screen`
  wrapper (the shell now owns the page frame and background). `EventDetail.tsx`/`ShowDay.tsx`
  deliberately kept their own contextual back button — they're reached from a specific event,
  not the rail.
- **News ticker**: `marketNews` scrolls across a footer bar (CSS `marquee` keyframe added to
  `tailwind.config.ts`) so the world stays visible without needing a dedicated page.
- **End Day ceremony** (`src/lib/daySummary.ts` + `src/components/shell/DaySummaryOverlay.tsx`):
  a pure `computeDaySummary(prev, next)` diffs the state before/after `advanceDay` — new
  transactions (by id, not truncated-list slicing), new market news (by id, since the news
  feed itself is capped to 10 and would otherwise look "empty" some days), reputation/balance
  deltas, a bankruptcy-transition flag, and a same-day morale-shift count. `GameContext.tsx`'s
  `advanceDay` wrapper computes this diff and stores it as ephemeral UI state (`daySummary` —
  deliberately *not* part of `GameState`/save data, no schema bump needed). The overlay is
  what actually dramatizes output `advanceDay` already computed but the old UI discarded
  silently (new contracts, competitor wins, missed-show penalties, morale events). Covered by
  3 new tests in `src/lib/__tests__/daySummary.test.ts`.
- **Code-split**: every route in `App.tsx` is now `React.lazy` behind a single `Suspense`.
  Main entry chunk dropped from 952KB to ~450KB; routes that don't touch `recharts`
  (Calendar, Crew, Inventory, ShowDay) no longer pull in its 389KB chart chunk at all —
  previously every route paid for it.
- **Bundle budget** (`scripts/check-bundle-budget.mjs`, wired into
  `.github/workflows/deploy-pages.yml` right after the pages build): fails CI if total JS
  exceeds 1400KB or any single chunk exceeds 500KB. Current total ~945KB — enough headroom
  for the plan's remaining workstreams (avatars, scene, map) before the budget needs raising,
  and any raise has to be a deliberate comment-explained edit, not a silent creep.
- Verified in a real browser (Playwright): HUD elements render and stay persistent across
  all 5 nav-rail destinations, the Next Day → day-summary overlay → Continue flow works
  end-to-end and surfaces a real competitor-won-contract news item, zero console errors, and
  a mobile-width (390px) spot check confirmed nothing breaks (stars/tier text intentionally
  hide below the `sm` breakpoint — full mobile nav-rail polish is not in scope for this PR).

### PR 2 status — Juice foundation (done)

- **`framer-motion` added** as a real dependency (not a lazy/dynamic-only import) — it's
  used by the always-mounted shell, so it has to be present from first paint. Given its
  own `manualChunks` entry in `vite.config.ts` (`vendor-framer-motion`) specifically so it
  doesn't inflate the main entry chunk it's imported from; without that split the entry
  chunk hit 562KB and failed the bundle budget check from PR 1 — this is exactly the
  scenario that budget check's own comment predicted ("adding framer-motion in PR 2 should
  bump this, not blow through it unnoticed"). With the chunk split, entry chunk is 443KB
  and the budget check passes with no threshold changes.
- **HUD balance now pops and flashes** (`GameShell.tsx`): a `motion.div` keyed on the
  rounded balance value re-triggers a quick scale-pop on every change, colored green/red
  for the delta's sign and settling back to neutral after ~900ms — layered on top of the
  existing `useCountUp` digit tween from PR 1, so the numbers count up *and* the container
  pops when a new target lands.
- **Floating `+$X`/`-$X` deltas** (`src/components/shell/FloatingDelta.tsx`): a small queue
  of delta events tracked via a `prevBalanceRef` diff in `GameShell`, rendered with
  `AnimatePresence` — each one drifts up and fades over ~1.1s, then prunes itself.
- **Day-summary ceremony polish** (`DaySummaryOverlay.tsx`): backdrop and card are now
  separate `motion.div`s — the backdrop fades in fast (the "night falls" beat), the card
  springs in ~150ms later with a slight scale+y offset, so advancing a day reads as two
  discrete beats instead of one flat dialog pop.
- **Card micro-motion**: `EventCard` and `CrewMemberCard` (both compact and full variants)
  get `whileHover`/`whileTap` scale via `motion.div` wrappers, gated off when the card is
  `disabled` or already assigned (no false affordance on a card you can't interact with).
- Verified in a real browser (Playwright): onboarding → HUD → all 5 nav-rail destinations →
  Next Day → day-summary overlay (with a real competitor-won-contract news item, matching
  PR 1's verification) → Continue → balance/date updated correctly, card hover confirmed on
  the Crew page with no console errors. Full suite: `tsc` clean, `eslint` clean (only the
  same pre-existing shadcn boilerplate warnings from before this branch), 85/85 tests
  passing, `budget:bundle` passing against the `build:pages` artifact.

### PR 3 status — Identity + avatars + venue art (done)

- **Procedural crew avatars** (`src/lib/avatarSeed.ts` + `src/components/CrewAvatar.tsx`):
  an FNV-1a string hash seeds `createRng` (the same seeded PRNG the sim uses, just fed a
  hash instead of `GameState.rngState` — cosmetic rolls, not a gameplay one, so it
  deliberately doesn't touch or consume the sim's shared rng sequence) to pick skin tone,
  hair style/color, and an optional accessory. Same id always renders the same face.
  Wired into `CrewMemberCard` (both compact and full variants — replacing the generic
  lucide `User` icon) and the hiring-market candidate cards in `Crew.tsx`. 3 new tests in
  `src/lib/__tests__/avatarSeed.test.ts` (determinism, trait-shape validity, and a
  variety check that 5 ids don't all collapse onto one hairstyle).
- **Venue art** (`src/components/VenueArt.tsx`): one SVG scene per reputation tier (dive
  bar → club → arena → stadium) — sky gradient, light beams, a truss, a stage, an LED wall
  at tier 3+, pyro bursts at tier 4, and a procedurally-laid-out crowd that gets denser per
  tier. Driven directly by `Event.venueTier` (already fixed at contract-generation time, no
  new engine logic needed). Wired into `EventCard` (both compact — thin banner strip — and
  full — taller banner) and `EventDetail`'s header.
- **Equipment icons** (`src/components/EquipmentIcon.tsx`): a real glyph per
  `EquipmentType` (PA stack, monitor wedge, lighting truss, LED wall grid, stage deck,
  power distro) replacing the one generic `Package` icon every equipment card used
  regardless of type. Wired into `EquipmentCard`.
- **Design-language pass** (`src/index.css`): a `tier-glow-{1-4}` utility (new `--tier-1`
  through `--tier-4` HSL tokens, light and dark) applied to `EventCard` so higher-tier
  shows visibly glow harder; a subtle radial-gradient + inline-SVG-noise background on
  `body` (no network request, no asset file — a data-URI `feTurbulence` filter at 3.5%
  opacity, deliberately faint enough to never threaten text contrast); and a styled
  system font stack (`ui-rounded, "Segoe UI Variable"...`) applied to `h1`/`h2`/`h3` at the
  element level so every page title and card title picks it up without touching each
  component — no webfont fetch, matching the plan's "self-hosted subset, or a styled
  system stack" option.
- Verified in a real browser (Playwright): fresh onboarding → Calendar (venue art banners
  on every event card, tier-glow visible) → EventDetail (venue banner + crew-roster
  avatars, all visually distinct) → Crew (hiring-market candidates and every roster card
  showing a unique procedural face) → Inventory (distinct icon per equipment type) → back
  to Dashboard (compact venue art on Upcoming Events, heading font applied, background
  texture present but unobtrusive) — zero console errors across all five. Full suite:
  `tsc` clean, `eslint` clean, 88/88 tests passing (3 new), `budget:bundle` passing
  (1069KB total, entry chunk unchanged from PR 2 since all three new components are pure
  SVG/CSS with no new runtime dependency).
- **Scope note**: the plan mentioned avatars appearing in "show-day incident prompts" —
  skipped here because `CrisisPrompt` isn't tied to a specific crew member in the current
  data model (it's keyed to `eventId`, not a crew id), so there's no id to seed a face
  from yet. Revisit if/when crisis content gets crew-specific in a later pass.

## 5. Explicit non-goals (same discipline as before)

- **No 3D / no game engine.** The rejected three.js/isometric idea stays rejected. 2D
  SVG/Canvas delivers the fantasy at a fraction of the cost and bundle.
- **No asset pipeline.** No sprite sheets, no audio files, no CDN. Procedural or nothing.
- **No multiplayer, no cloud saves, no modding** until well after all of the above.
- **No sim rebalance mixed into presentation PRs.** Balance changes ride separately so
  regressions stay attributable.
