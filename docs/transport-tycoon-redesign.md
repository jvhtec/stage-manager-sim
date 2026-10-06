# Stage Manager Sim — The Transport Tycoon Redesign

> **Status:** first playable slice shipped on `claude/transport-tycoon-redesign-2qfm5y`. The
> map game is now the default experience at `/`; the previous dashboard build is kept intact at
> `/classic` while its systems are ported across. This document supersedes the sequencing in
> `docs/game-feel-plan.md` and `docs/tycoon-game-plan.md` — those plans polished a management
> dashboard; this one changes what kind of game it is.

## 1. Why the old build was "far from Transport Tycoon"

The previous plans fixed real problems (persistence, economy, juice), but the *genre* never
changed. Side by side with Transport Tycoon:

| Transport Tycoon | Old Stage Manager Sim |
|---|---|
| The **map is the game** — you play on it, everything else is a window over it | Pages of cards; the map didn't exist (a city map was "PR 6" of the game-feel plan) |
| **Continuous time** with pause/fast-forward; you watch things happen | A "Next Day" button and a summary of what changed |
| The core skill is **logistics**: distance, capacity, speed, routes | Crew/gear assignment was a form; travel was a number on a card |
| **Vehicles are units** — you buy them, they age, break down, need servicing, earn their keep | No vehicles at all |
| **Infrastructure** (stations/depots) decides where you can operate | One abstract company with no location |
| **New models arrive over the years** | No era progression |
| Towns of different sizes have different demand; **local ratings** matter | Venues were strings in a tier table |
| Rivals visibly operate on the **same map** | Rivals were names in a news feed |
| **Isometric world** you can scroll around | shadcn dashboard |

## 2. The mapping — what each TT pillar becomes in a touring-production game

| TT concept | Stage Manager Sim | Where |
|---|---|---|
| Isometric tile map with heights, water, forests | Procedurally generated island (72×56 tiles), integer corner heights, coast, lakes, bridges | `src/world/mapgen.ts`, `src/tycoon/render/*` |
| Towns that grow | Villages → towns → cities → one metropolis; **town size decides which venues exist** (pub → hall → club → theatre → arena → stadium), so geography *is* the progression ladder | `mapgen.ts` (`SIZE_VENUES`) |
| Cargo | Gear units per department (audio / lighting / video / staging) + crew as passengers | `catalog.ts`, `sim.ts` (`loadVehicle`) |
| Delivery deadline / cargo payment | A show's **load-in at 10:00**. Late, short on gear or crew → lower quality → lower fee. Nothing arrives → no-show penalty | `sim.ts` (`playShow`) |
| Stations & depots | **Warehouses**: gear, crew and trucks are based at one. Build regional ones to cut drive times | `actions.ts` (`buildDepot`) |
| Road vehicles | Splitter vans, Luton box vans, 7.5t rigids, 40ft artics, crew sleeper buses… with capacity, seats, speed, price, running cost, reliability, lifespan | `catalog.ts` (`VEHICLE_MODELS`) |
| New vehicle models by year | Game starts 1 Jan 1990; artics arrive 1992, sleeper buses 1994, etc., announced in the news | `sim.ts` (`announceModels`) |
| Vehicle orders | A vehicle's order list is a list of booked shows; **a multi-show order list is a tour** — the truck goes straight from venue to venue, or pops home in between if there's time | `sim.ts` (`decide`) |
| Breakdowns & servicing | Reliability decays daily (faster past lifespan); breakdowns strand a truck for hours mid-route; auto-service every 45 days at its depot | `sim.ts` |
| Local authority rating | Per-town standing (Appalling → Outstanding) — raised by good shows, crushed by no-shows; nudges fees and how often rivals beat you to work there | `offers.ts`, `ui/places.tsx` |
| Competitors | Rivals have HQ warehouses in their brand colour and their trucks physically drive to the shows they win | `offers.ts` (`rivalsTakeOffers`) |
| Finances window, loan, company value, bankruptcy | TT-style yearly ledger by category, $10k loan steps, company value; three month-ends in the red ends the company | `ui/company.tsx`, `sim.ts` (`monthlyTick`) |
| Newspaper pop-ups | Show results, breakdowns, new models, rival wins as newspaper-style cards | `TycoonGame.tsx` |

Reputation still gates venue tiers (Local Circuit → Regional → National → World Class), but
**each tier caps the reputation it can earn you** — you can't become world-class playing pubs.
To climb, you must take on bigger rooms, which need bigger trucks and more gear.

## 3. The isometric presentation

Rendered on a 2D canvas the way TT did it — a 2:1 isometric projection, painter's algorithm by
tile diagonal — rather than three.js. That keeps it crisp at any zoom, tiny (the whole game is a
~106KB lazy chunk with no new dependencies), and fast enough for phones.

- **Terrain**: heightmapped tiles with slope shading, sand coasts, animated water glints,
  forests, rough ground, and a dirt "slab" edge so the island reads as a diorama.
- **Roads** follow the terrain, with lane markings when zoomed in and timber bridges over water.
- **Buildings** are procedural extruded boxes: pitched-roof houses, brick and concrete blocks,
  glass towers with rooftop plant, windows that light up at night.
- **Venues** each have a recognisable silhouette: the pub (Tudor beams, hanging sign,
  chimney), town hall (columns), club (black box, neon trim), theatre (marquee that lights up
  for a show, fly tower), arena (domed drum), stadium (open bowl, seating rings, pitch,
  floodlight masts).
- **Warehouses** wear the owner's livery: brand-coloured corrugated roof, stripe, loading
  bays, office, waving flag; your trucks line up in the yard.
- **Vehicles** are drawn per type (van, box truck, artic with trailer, bus) in company colours,
  keep to their lane, follow slopes and bridges, show headlights at night, and smoke and blink
  when broken down.
- **Day/night cycle**: the whole scene dims and blue-shifts at night; live shows throw
  searchlight beams into the sky in the promoter's colours.
- **Overlays**: TT-style town name plates, floating price tags over venues with offers
  (greyed with a lock when your reputation is too low), countdown flags over your booked shows,
  rival dots over theirs.

Controls: drag/pinch to pan, wheel/pinch to zoom, click anything to open its window; space
pauses, 1–4 set the speed, Esc closes the top window; any vehicle can be **followed**.

## 4. Engine

`src/world/**` is pure TypeScript, deterministic from a seed, and unit-tested
(`src/world/__tests__/*.test.ts`, 47 tests):

- The **map is never saved** — it's regenerated from `mapSeed` (memoised), so saves are small.
- `advanceHours(state, n)` is the only clock: vehicles step along cached road paths each game
  hour, shows resolve at 23:00 from whatever was actually on site by 20:00, and wages/running
  costs/offers/rivals tick daily; depot upkeep, loan interest and the solvency check monthly.
- All randomness goes through the seeded `rngState` (same discipline as `src/lib/rng.ts`).
- Actions (`src/world/actions.ts`) are `(state, …) → { state, result }`, same pattern as
  `src/engine/**`.
- Save key `stage-manager-sim:tycoon` (v5: star techs, real populations) — separate from the classic save.

A headless bot played two in-game years on three seeds during tuning: it survives, but stalls at
Local Circuit unless it buys bigger trucks and more gear. That upgrade pressure is intended.

## 5. Real-world content (personal build)

All of it lives in plain data files under `src/world/content/` so it's easy to edit:

- **Artists** (`artists.ts`) — ~75 real acts with approximate career arcs as `[year, tier]`
  breakpoints (tier 0 = split/hiatus). In 1990 U2 and the Stones play stadiums; Oasis appears
  in pubs in 1993 and is filling stadiums by 1996; Coldplay, Arctic Monkeys, Ed Sheeran, Billie
  Eilish arrive in their eras. Pubs mix real early-career acts with fictional local bands;
  arenas and stadiums are always real acts. Do an act proud (≥75%) and they remember: their
  later offers come to you more often, pay 10% more, are marked **♥ Asked for you**, and rivals
  are far less likely to poach them.
- **Rival companies** (`companies.ts`) — Clair Brothers, Sound Image, Britannia Row, Wigwam,
  Thunder Audio, Light & Sound Design, Neg Earth, Eighth Day Sound, Tycho Brahe, Delta and
  Silverfish trade from day one, each with a specialty department and the venue tiers they
  chase. XL Video (1993), Christie Lites (1994), Creative Technology (1996) and Solotech (2005)
  arrive later; LSD becomes PRG (2001), Clair becomes Clair Global (2010), XL Video is absorbed
  into PRG (2011). Entries marked `// verify` are guesses. Towns have several warehouse lots
  (1 in villages, 2 in towns, 3 in cities) shared between you and rivals. Shown in a TT-style
  **company league**.
- **Tours** (`tours.ts`, `content/world.ts`) — club, theatre and arena tours bundle 3-6 dates
  in different towns with a completion bonus; put one truck on the whole tour and it drives the
  route. **World tours** for stadium and arena acts add one or two overseas legs (Europe, North
  America, Latin America, Asia-Pacific) played in real venues — Bernabéu, Madison Square Garden,
  Tokyo Dome… The rig is trucked to the metropolis's international airport by a freight cutoff,
  flown out for the run (days of freight each way, per-unit freight and crew flights charged),
  and flown back for collection. The airport is on the map; freighters take off while a rig is
  abroad.
- **Gear brands** (`gear.ts`) — gear is now real product units (Martin Audio F2, Meyer MSL-3,
  L-Acoustics V-DOSC → K1 → K2, d&b J/GSL; PAR cans, Vari-Lite VL2, Martin MAC 500/2000, Clay
  Paky Sharpy, Robe BMFL, grandMA2/3; JumboTron → LED → ROE Black Pearl; Steeldeck, Prolyte,
  Tomcat, Kinesys, TAIT), each with a launch year and a 1-10 quality. Crowds' expectations rise
  every year (`expectedQuality`), so the kit you started with goes from flagship to pub rig;
  dated kit scales the show down. Artist **riders** name a brand in one department — honour it
  for a bonus, ignore it for a penalty. Trucks load the rider brand first, then the best kit.
- **Vehicles** carry real names: Ford Transit, Iveco Daily, Leyland DAF 45, Volvo FH12, Neoplan
  Skyliner, Mercedes Sprinter, Scania R.

- **Countries** (`content/countries.ts`) — pick España, UK, USA, Deutschland, France or Italia
  at new game. Same procedural geography, but towns take real city names (biggest town = the
  capital/largest city), venues are named the local way (Sala…, Zénith de…, PalaSport di…) and
  famous rooms appear where the map puts them (Bernabéu, WiZink, Wembley, MSG, Bercy, San
  Siro…). Prices show in €, £ or $. Rivals are the local firms of that country plus the
  international giants (Clair, PRG, Solotech); local acts (Héroes del Silencio, Estopa, Rosalía…;
  Die Toten Hosen; Indochine; Vasco Rossi…) only tour at home and come up more often there.
  World-tour legs never fly to your own country.
- **Consoles** — mixing desks are their own gear slot: every show needs a FOH desk, monitors
  from club level up and a spare at stadiums. 17 desks from the Yamaha PM3000 and Midas XL3
  through PM1D, D5, VENUE, XL8, SD7 to RIVAGE PM10, S6L and Quantum7. Riders can name a console
  brand.
- **Gear art** — every product has a pixel-art sprite (point source, line array, analogue and
  digital desks, PARs, moving heads, beams, LED walls, projectors, truss, hoists…) tinted in
  its brand colour, and brands/companies show as typographic badges in their colours. For a
  personal build, official logo files can be dropped into `public/brands/` and listed in
  `public/brands/index.json` — they then replace the badges (see the README there).

- **Start years** (1975, 1980, 1985, 1990, 2000, 2010) — the era sets which trucks, gear and
  desks exist (Bedford TK, Altec A4s, Yamaha PM1000 and Strand lanterns in 1975; no video kit
  until the mid-'80s), your starter rig (the cheapest kit a pub crowd of that year will accept),
  which acts are touring (Led Zeppelin, The Who, Miguel Ríos, Barón Rojo… through to today) and
  which firms are trading. Companies arrive, rebrand and fold in their real years — e.g. in
  Spain LIL Service (1979, later Twin Cam Audio), Milán Acústica (1981), Berenice, Sorter,
  Apogee, then Fluge (1991); in the US Tycobrahe Sound (1968–81) and Silverfish (→ Sound Image,
  1984). Rivals set up in their real home city when it's on the map.

- **Real populations** — towns carry approximate real metro-area populations (Madrid 6.8M,
  London 9.8M, New York 19.5M…), ranked so the biggest market gets the stadium. Show offers
  scale with each town's venue scene (its size class), not raw population, so the economy
  stays balanced; the UI calls towns major / large / mid-size / small markets.
- **Star techs** (`content/techs.ts`) — a handful of real big-name crew per era, in their
  professional roles only: FOH engineers (Bruce Jackson, Buford Jones, Joe O'Herlihy, Dave
  Natale, Big Mick Hughes, Robert Scovill), lighting/show designers (Marc Brickman, Patrick
  Woodroffe, Willie Williams, LeRoy Bennett, Peter Morse), staging/production (Mark Fisher,
  Jake Berry, Es Devlin). They're hireable during their career window for a signing fee and a
  day rate, ride with a truck, and lift every show that truck plays (more for acts they're
  known for); they retire when their careers did. Add local legends with `countries`.

Years and careers are approximate and for flavour. This uses real names for personal play;
note that pushing to `main` publishes the build to GitHub Pages.

## 6. Phones & tablets (PWA)

- **Installable**: `public/manifest.webmanifest` (standalone, any orientation, maskable
  icons generated from `public/icons/icon.svg`), iOS home-screen meta tags and
  `apple-touch-icon`. Android/Chrome shows an **Install app** button (More menu / toolbar);
  iOS players use Share → Add to Home Screen (explained in-game).
- **Offline**: `public/sw.js` — network-first app shell, cache-first hashed assets. Saves are
  localStorage, so a game in progress keeps working offline. Registered only in production
  builds, scoped to the Pages base path.
- **Compact layout** (`max-width: 760px` or `max-height: 520px`, `src/tycoon/useLayout.ts`): a
  top HUD (play/pause, speed, date, rep, cash), a bottom tab bar (Shows · Fleet · Towns · Bases
  · Money · More), floating map controls, and windows as a single stack of sheets with **Back**
  — docked to the bottom in portrait, to the right in landscape. Bigger touch targets, finger
  hit-slop on map markers and vehicles, notch/home-indicator safe areas, no iOS zoom-on-focus or
  rubber-banding. "Show on map" aims at the part of the map the sheet doesn't cover.
- **Battery**: the canvas redraws every frame only while something moves; when paused it idles
  at ~12 fps for the ambient animation.

## 7. Not ported yet (and where each lands)

The classic build has systems that don't exist in the map game yet. Each has an obvious home:

| Classic system | Map-game home |
|---|---|
| Individual crew (skills, XP, morale, fatigue, avatars, hiring market) | Crew become named people based at warehouses; seats in vehicles carry *specific* techs; skill feeds show quality, long tours drain fatigue (sleeper buses help) |
| Crises (planning / execution prompts) | **Road incidents** (breakdown: wait, tow, or hire a local van), **show incidents** at the venue, both as TT-style pop-ups with choices |
| Equipment condition & maintenance | Gear wear per tour leg; servicing gear at warehouses alongside vehicles |
| Show Day scene | Click a venue during a live show → zoom-in performance view (the scene from the game-feel plan, now reachable from the map) |
| Rentals | Local hire at the venue town when you're short — expensive, but saves a no-show |
| Festivals | Multi-stage events at the stadium city needing several trucks arriving in a window |

## 8. Next steps (PR-sized)

1. **Playtest & balance pass** — fee/wage/running-cost tuning, offer density, rival aggression.
2. **Named crew at warehouses** — port crew progression and hiring into the map game.
3. **Road & show incidents** — port the crisis system as pop-up decisions.
4. **Tour planner** — drag-to-order a vehicle's show list, "add next show in route" suggestions,
   route lines drawn on the map for the selected vehicle.
5. **Gear transfers & local hire** — move stock between warehouses; hire locally when short.
6. **Sound** — WebAudio engine hum, crowd swell at live venues, cash-register on payouts.
7. **Town growth & more eras** — towns grow with successful shows; new gear tech (LED walls,
   line arrays) unlocks by year like vehicle models.
8. **Retire `/classic`** once its systems are ported.
