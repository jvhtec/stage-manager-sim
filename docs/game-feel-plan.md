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
| 1 | **Shell + HUD + code-split** | Workstream A, route lazy-loading, bundle budget in CI | The frame everything else mounts into; biggest feel-win per line |
| 2 | **Juice foundation** | framer-motion, animated numbers, transaction deltas, day-transition ceremony polish | Makes the sim's existing outputs *felt*; shell (1) provides the mount points |
| 3 | **Identity + avatars + venue art** | Workstream B | Pure content; unblocks the scene (needs venue backdrops + avatars) |
| 4 | **Show Day scene v1** | Workstream C: stage, crowd, phases, incidents-over-scene, results sequence | The centerpiece; depends on 2 + 3 |
| 5 | **Sound** | Workstream D audio module, wired into HUD + scene | Scene exists to score; independent of 6-8 |
| 6 | **City map** | Workstream E incl. travel-from-distance engine change | Big but isolated; makes market + competitors spatial |
| 7 | **Milestones + tutorial contract** | F1 + F2 | Gives the polished loop a spine for new players |
| 8 | **Daily events** | F3 | Cheap once the End Day summary (1) exists |
| 9+ | **Tours, then festivals** | F4, one PR each | The content ceiling, landing on finished presentation |
| 10 | **Difficulty + sandbox** | F5 | Trivial closer; good "1.0" marker |

Each PR keeps the tycoon plan's rules: engine changes tested, schema bumps versioned,
browser-verified with screenshots, tracker updated in this file.

## 5. Explicit non-goals (same discipline as before)

- **No 3D / no game engine.** The rejected three.js/isometric idea stays rejected. 2D
  SVG/Canvas delivers the fantasy at a fraction of the cost and bundle.
- **No asset pipeline.** No sprite sheets, no audio files, no CDN. Procedural or nothing.
- **No multiplayer, no cloud saves, no modding** until well after all of the above.
- **No sim rebalance mixed into presentation PRs.** Balance changes ride separately so
  regressions stay attributable.
