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

On top of the venue tier, **real acts' management sets its own reputation bar** (`standing.ts`):
by the biggest tier the act has played so far (10 / 35 / 62 / 85), plus 7 per tier the act
is still headed up (signed acts on the way up already use established firms), plus 5 for
international names, minus 4 per point of history with you (max 20). So AC/DC won't hire a
starter company even for a 1975 club date; local bands only care about the venue. Offers and
tours from acts beyond your reach come up less often (and show locked), rivals need the same
standing to win them, and the starter tour is always with an act that will hire you (an
up-and-coming local band when no real name would).

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
(`src/world/__tests__/*.test.ts`, 103 tests):

- The **map is never saved** — it's regenerated from `mapSeed` (memoised), so saves are small.
- `advanceHours(state, n)` is the only clock: vehicles step along cached road paths each game
  hour, shows resolve at 23:00 from whatever was actually on site by 20:00, and wages/running
  costs/offers/rivals tick daily; depot upkeep, loan interest and the solvency check monthly.
- All randomness goes through the seeded `rngState` (same discipline as `src/lib/rng.ts`).
- Actions (`src/world/actions.ts`) are `(state, …) → { state, result }`, same pattern as
  `src/engine/**`.
- Save key `stage-manager-sim:tycoon` (v6: market, festivals, wear, crew, contracts, awards; v5 saves are migrated by `migrate()`) — separate from the classic save.

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
- **Rival companies** (`companies.ts`) — the international giants (Clair Brothers → Clair Global
  2010, Light & Sound Design → PRG 2001, Solotech 2005) trade everywhere; each country adds its
  own period-accurate roster. UK: Martin Audio's '70s PA hire (to 1988), Britannia Row (Clair
  Global from 2017), Wigwam, Skan PA Hire (to Britannia Row 2024), SSE, Neg Earth, Adlib,
  Capital, Delta Sound (1988, later DeltaLive), XL Video, Creative Technology, ESS PA, 22live
  (2022). US: Tycobrahe, Silverfish → Sound Image, Showco, Thunder Audio, Eighth Day, Bandit,
  Upstaging, Firehouse, Christie. Spain: LIL Service → Twin Cam, Milán Acústica, Berenice,
  Sorter, Apogee, Fluge, Pronorte, Sonido Tole. Plus France, Germany and Italy. Each has a
  specialty department, the venue tiers they chase, an HQ town, and entry/rename/exit years.
  Entries marked `// verify` are guesses. Towns have several warehouse lots (1 in villages, 2
  in towns, 3 in cities) shared between you and rivals. Shown in a TT-style **company league**.
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

## 7. Strategy depth

The layer that turns logistics into a business. Each system is its own module in `src/world/`
and reads through `marketNow` / `policies` so the UI shows exactly what the sim uses.

- **Market calendar** (`market.ts`, `content/economy.ts`) — seasonal demand (summer ×1.3,
  January ×0.6) and period-accurate climate per country moving offer volume and fees: the oil
  crisis, early-'80s and early-'90s recessions, La Movida, reunification, Barcelona/Expo '92 and
  the '93 hangover, the live boom, 2008, the euro debt crisis, the festival boom, the 2020-21
  shutdown (calendar cancelled under force majeure, country wage schemes cover 70% of wages,
  repayment holiday) and the rebound. Loans charge the era's central-bank rate (BoE, Fed, Banco de
  España, Bundesbank, Banque de France, Banca d'Italia, then ECB) + 3.5%.
- **Festivals** (`festivals.ts`, `content/festivals.ts`) — ~50 real festivals with founding and
  fallow years, growth and stage names. Two months out each tenders its main and second stage as
  multi-day contracts at the host town (`Gig.days`, `Gig.festival`); book before the close or the
  best-placed rival wins. Main stages need 1.3× the rig.
- **Gear wear** (`wear.ts`) — per-product condition; shows wear what they use (per show day,
  overseas 1.6×); worn kit is derated to 70% quality at zero, sells for less, and fails mid-set
  (once per show day, removing units). Workshop policy none/basic/full (0.8% / 2.2% of
  replacement value per month, repairing to 80% / 100%) and per-line refurbishing.
- **Crew** (`crew.ts`) — fatigue on the road (+4/day on site, +3 travelling, −10/day at home)
  derating crew to 65% when exhausted; pay policy (×0.8 / ×1 / ×1.25 wages) sets the morale crews
  drift to monthly, less fatigue; morale nudges every show ±0.06 and below 40 people quit.
- **House contracts** (`contracts.ts`) — venues tender a year as house PA & lighting supplier for
  a retainer (40% of a show fee per month). The rig is installed from your warehouse in that
  town; shows there run on it and rivals can't take them. Breaking costs three months.
- **Incidents & insurance** (`incidents.ts`) — break-ins, road accidents and festival storms
  (likeliest in Britain); insurance none / basic (60%) / comprehensive (100% incl. weather) with
  premiums on the replacement value of gear and fleet.
- **Rating & awards** (`awards.ts`) — a 0-1000 company rating per year and an awards night every
  January (Parnelli Awards in the US from 2001, TPi Awards in the UK from 2003, otherwise the Live
  Production Awards) with reputation and sponsorship prizes.

- **Bases & staff** (`facilities.ts`) — delegations (branch office: 25 units, vans and crew
  buses only, local contacts) and warehouses in three sizes (120 / 320 / 800 units; medium needs
  Regional reputation, large National), with rent scaled by town size (×0.6-×1.5). Full-time
  staff per base on salaries: warehouse & prep (45 units each; unprepped kit fails up to 1.6× as
  often and cases get left behind) and sales & office (+12% offers per head nearby, up to +60%,
  and local rating). Gig technicians are separate: on the payroll at a base, or local
  freelancers hired per show day at the venue (pool by town size; 25% cheaper, more of them and
  better with a base in town).
- **Road costs** — fuel per tile (by truck size) and per diems + hotel per crew member per night
  away from base (sleeper buses skip the hotel); the show forecast estimates road costs and margin.
- **Close-ups** (`render/diorama.ts`) — isometric cutaway scenes in the base and venue windows:
  racks holding your actual stock, prep crew, office, workshop bench, gig techs, trucks in the
  bays; venues by kind with the stage, era-correct PA (stacks before 1993, line arrays after),
  truss, LED screen, FOH and crowd, through load-in, show (beams) and load-out.

- **Special events** (`events.ts`, `content/events.ts`) — ~65 real events per country (Live Aid,
  the Mandela tribute, Knebworth, Live 8, The Wall in Berlin, Barcelona '92, the Bicentenaire,
  Jarre at La Défense, Pavarotti & Friends, Olympic/World Cup ceremonies, Eurovision when hosted,
  MTV EMAs) and recurring dates (BRITs, Super Bowl halftime, Farm Aid, Goyas, Sanremo, Primo
  Maggio). Tendered 50-110 days ahead by department; sealed bids (sharp ×0.85 / standard /
  premium ×1.2) scored on reputation^1.3 × specialty ÷ price against the rivals in the league;
  organisers want reputation 45/62/75 by scale. Broadcasts take −0.15 for anything late, missing
  or failing; ±2-7 reputation by scale; "Special Event of the Year" award. Citywide events
  (Fête de la Musique, Love Parade) spawn extra small shows.
- **Rental market** (`hire.ts`) — sub-hire shortfalls from rivals within 40 tiles (5 units per
  rival per department, quality a notch below expectations, 10% of replacement value per day);
  rent idle kit out (0.12%/day income, extra wear).
- **Transfers** (`transfers.ts`) — courier kit between your bases (by units × distance, arrives
  after the drive).
- **Rival finances & takeovers** (`rivals.ts`) — monthly health from the economy, wins and mean
  reversion (big names floored at 20); at 0 a firm goes under and frees its lot. Buy a rival
  (price by reputation, size and health; you need reputation within 15 of theirs): their base,
  used era kit, crew and 6% of their reputation become yours.

- **Finance** (`finance.ts`) — the credit line is 60k + half your assets + up to 150k for your
  company rating (replacing the fixed cap; borrow in tenths of it). Lease vehicles at 2.5% of the
  price per month (24-month term; handing back early costs two months).
- **R&D** (`rnd.ts`) — needs reputation 40+ and a warehouse with 2+ prep staff. Refinement /
  new flagship / breakthrough: +0.3 / +0.8 / +1.5 quality over the market's best, 9 / 15 / 24
  months, 5 / 15 / 35% risk, cost from the flagship price. Success puts your own product in the
  gear shop (encoded in its id, so saves need no registry) at 60% of market price, earns
  reputation, and pays royalties monthly by your standing, fading over eight years.
- **Production deals** (`deals.ts`) — acts with 3+ good shows together may offer a two-year
  exclusive: a retainer (25% of a show fee per month), their tours come straight to you (rivals
  don't bid) and more often. A lapsed tour or a bad night (<50%) is a strike; two and they walk
  (relation reset, −3 reputation). One-year cooldown between offers.
- **Named crew** (`people.ts`, `content/names.ts`) — gig technicians are people with names from
  your country, a main department (sound, lighting, video, staging) at 1-5★ plus maybe a second
  string, a trait (crew chief +0.03 show quality, perfectionist ×0.85 failures, road warrior 0.6×
  fatigue, party animal +morale, polyglot better abroad, mentor 1.5× learning), personal fatigue,
  and a day rate of 0.85-1.45× the going rate by level. Each show splits `crewNeeded` into slots
  by its departments' needs (consoles count as sound); the best-matched people fill them, each
  worth 0.55 (out of their depth) to 1.2 (5★) × fatigue. Trucks board the freshest, best-matched
  people for the job ahead. People level up in the department they work (10/30/60/110 shows per
  level) with a raise; training adds monthly progress at base; below 40 morale people quit.
  **Pins**: pin someone to a truck and they always ride it from its base (and never board another).
  **Rest rota** policy (everyone works / fatigue 70+ stays home / fatigue 50+ stays home) — fresher
  crews and morale against more freelancer seats; pins override it. **Counter-offers**: below 50
  morale rivals make offers to 3★+ people (+15-45%, likelier for higher stars); you have 14 days
  to match (their day rate rises by the raise and they turn rivals down for a year) or they leave
  — once back at base, never mid-tour. A hiring market refreshes monthly per base (stars are rare, rarer
  for small firms); old saves' headcounts become people. Depot/vehicle `crew` and averages are
  cached by `syncCrew`.

- **Decisions** (`dilemmas.ts`) — problems that need your call, popping up as a "Needs your call"
  window and stopping the clock. A player truck breaking down with a show waiting offers wait /
  call recovery (£, moving within the hour) / bodge it (free, reliability −8). At load-in a booked
  show you're delivering has a 6-12% chance (more for big tiers) of a venue problem: undersized
  power (generator vs house power: dimmers trip, ×1.6 failures), union call (extra hands vs a
  sulky load-in and town rating), the manager's extras (better show + relation vs a cooler act),
  curfew (fine vs cut-short set), an injured tech (send home vs play on exhausted), or a storm
  warning at festivals (ballast ×0.35 storm odds). Choices become `gig.mods` folded into the
  night's quality/failure/weather; unanswered, the cheap default happens at the deadline.

UI: **Market** window (climate, season, festival calendar, rates), **Company policies** window
(workshop, pay, insurance), Shows → **Contracts**, condition/fatigue chips, failure risk in the
show forecast, rating and trophy cabinet in the **League**.

## 8. Not ported yet (and where each lands)

The classic build has systems that don't exist in the map game yet. Each has an obvious home:

| Classic system | Map-game home |
|---|---|
| Individual crew (skills, XP, avatars, hiring market) | Done: named people with skills, traits, XP, a hiring market (people.ts); avatars still to come |
| Crises (planning / execution prompts) | **Road incidents** (breakdown: wait, tow, or hire a local van), **show incidents** at the venue, both as TT-style pop-ups with choices |
| Show Day scene | Click a venue during a live show → zoom-in performance view (the scene from the game-feel plan, now reachable from the map) |
| Rentals | Local hire at the venue town when you're short — expensive, but saves a no-show |

## 9. Next steps (PR-sized)

1. **Playtest & balance pass** — fee/wage/running-cost tuning, offer density, rival aggression.
2. **Named crew** — done (`people.ts`), with pins, rest rota and counter-offers.
3. **Road & show incidents** — done (`dilemmas.ts`): breakdown and venue decisions.
4. **Tour planner** — drag-to-order a vehicle's show list, "add next show in route" suggestions,
   route lines drawn on the map for the selected vehicle.
5. **Gear transfers & local hire** — move stock between warehouses; hire locally when short.
6. **Sound** — WebAudio engine hum, crowd swell at live venues, cash-register on payouts.
7. **Town growth & more eras** — towns grow with successful shows; new gear tech (LED walls,
   line arrays) unlocks by year like vehicle models.
8. **Retire `/classic`** once its systems are ported.
