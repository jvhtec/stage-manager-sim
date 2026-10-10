# Stage Manager Sim — The Transport Tycoon Redesign

> **Status:** shipped. The map game is the whole app; the previous dashboard build (`/classic`)
> has been retired and removed. This document supersedes the sequencing in
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
| Isometric tile map with heights, water, forests | A miniature of the chosen country (72×56 tiles): real coastline, mountains where the real ranges are, the real towns at their real relative positions (drawn oversized), integer corner heights, bridges over straits | `src/world/mapgen.ts`, `src/tycoon/render/*` |
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
  forests, rough ground, and a dirt "slab" edge so the map reads as a diorama. Everything casts a
  soft shadow (one convex hull per object, drawn in a ground pass before the object pass), water
  deepens away from the shore with foam along it, and roads have kerbs and lane marks when zoomed in.
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
(`src/world/__tests__/*.test.ts`, 344 tests):

- The **map is never saved** — it's regenerated from `mapSeed` (memoised), so saves are small.
- `advanceHours(state, n)` is the only clock: vehicles step along cached road paths each game
  hour, shows resolve at 23:00 from whatever was actually on site by 20:00, and wages/running
  costs/offers/rivals tick daily; depot upkeep, loan interest and the solvency check monthly.
- All randomness goes through the seeded `rngState` (same discipline as `src/lib/rng.ts`).
- Actions (`src/world/actions.ts`) are `(state, …) → { state, result }`, same pattern as
  `src/engine/**`.
- Save key `stage-manager-sim:tycoon` (v6: market, festivals, wear, crew, contracts, awards; v5 saves are migrated by `migrate()`) — the dashboard build's old save key is no longer read.

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
  at new game. Each is a **miniature of the real country** (see below); towns are the real
  cities (biggest = the capital/largest city, with real populations), venues are named the local way (Sala…, Zénith de…, PalaSport di…) and
  famous rooms appear where the map puts them (Bernabéu, WiZink, Wembley, MSG, Bercy, San
  Siro…). Prices show in the money of the day: £ and $ throughout, but pesetas, marks, francs and lire before the euro arrives in 2002 (`content/currency.ts` — the game's numbers are kept in euro-equivalents and printed at the fixed conversion rates, so a €3,000 fee in 1990 Spain reads 499,158 pts). Rivals are the local firms of that country plus the
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

- **Real geography** (`content/geo.ts`, `geoParams.json`, `landmasks.ts`, `scripts/gen-landmask.mjs`) —
  each country's map is its real shape. The coastline is rasterised offline from Natural Earth
  (public domain) onto the 73×57 corner grid (neighbouring countries count as land, so Spain
  touches France and Portugal) and shipped as a few hundred base64 bytes per country; re-run
  `node scripts/gen-landmask.mjs` after editing a bounding box. A shared projection puts each
  real city at its true latitude/longitude, then towns are placed biggest-first on the dry ground
  nearest their real spot that leaves earlier towns their elbow room — cities are *oversized* (radius
  2 to 6 tiles), so crowded regions (northern England, the US north-east) fan out a little. Mountain
  ranges (Pyrenees, Alps, Highlands, Rockies…) are polylines that lift the ground around them; the
  coast is flat beach. Towns near the sea sit at beach level, inland ones may stand on a low
  plateau; roads cross narrow straits on bridges. The seed only varies the rolling hills, the
  woods, venue sizes and each town's street layout — "Reroll terrain" in the setup screen.
  Grid size follows the country: Spain and France use 72×56; Britain (59×91, ~11 km a
  tile), Italy (80×91, ~13 km), Germany (59×81, ~11 km) and the US (115×62, ~45 km) get grids sized
  so their oversized towns aren't cramped. Every town is guaranteed its full set of venues and
  warehouse lots (on a thin peninsula like Florida the last lot may sit on a gentle slope). **Distance is real distance**: a tile knows its kilometres, one game unit
  is 18 km, and speeds, fuel, ranges and trip times are all in units, so a 300 km run takes the same
  time in Britain as in the States and the UI speaks km (miles in Britain and the US) rather than
  tiles. The consequence is that America is huge — its towns are a few thousand km apart — so American
  promoters pay 45% more (`offers.COUNTRY_FEES`: bigger production budgets, the haulage in the price) and team
  drivers (below) earn their keep there: a smart-bot test company ends 9 years at ~$12M with one driver per truck and
  ~$13M with team drivers, against £/€10–14M in Europe. Saves from before the real maps are discarded (save v7).

- **Roads, borders and crossings through the years** (`infra.ts`, `pathfinding.ts`, `geoParams.json`) — the
  map is generated once per seed and country; each year gets an *era* view of it (cached per distinct era):
  - **Motorways**: real corridors (M1, AP-7, the Autostrada del Sole, the A24 Hamburg–Berlin in 1982, I-10 finished in
    1990…) with their opening years. Each gets its own direct road at generation; once open, its tiles cost 65% of an
    ordinary road's time and are drawn wider with a central reservation. Tolls per km on Spain's autopistas and all
    French and Italian motorways, and on German autobahns for lorries from 2005.
  - **Crossings**: a road over water is a bridge if the land on both sides joins up anyway (an estuary, a ria) and a
    ferry if it doesn't (another island or landmass): two hours to board plus a fare. Fixed links replace ferries in
    their real year (the Channel Tunnel, 1994). Narrow straits the coarse mask would close (Messina, Dover) are carved
    back open so islands stay islands; a Liverpool–Dublin lane crosses the Irish Sea. Ferries are drawn as dashed
    lanes with a boat plying them; the tunnel as a faint line under the sea; borders as dashed lines (red for the
    inner-German border while it stands).
  - **Towns just over the border** (Lisboa, Porto, Toulouse; Dublin, Lille; Praha, Zürich, Strasbourg, Salzburg;
    Bruxelles, Genève, Barcelona, Torino; Ljubljana, Zagreb, Lugano, Nice; Toronto, Montréal, Monterrey) with their
    famous rooms (Pavilhão Atlântico from 1998, the Point Depot 1988–2008, Hallenstadion…). They offer shows at 45%
    of a home town's rate and you can't open a base there.
  - **Borders**: going to a town abroad costs the queue and, where customs apply, an agent's fee and carnet: customs
    until the EU single market (1993) or always outside it (Switzerland, the North American borders, Britain after
    Brexit), passport checks until both sides are in Schengen (never between Britain and Ireland), and the GDR's
    transit checks into the East and Berlin until 1990. A road that merely skirts a neighbour between two home towns
    doesn't count.
  - Time costs (motorway speed, boarding, border queues, converted to distance at a lorry's pace) are part of every
    route's length, so ETAs, planners, fuel and ranges all agree. Money costs (tolls, fares, customs) are charged as a
    truck sets off and booked as "Tolls, ferries & customs". The show and town windows list what's on the road; the
    run planner includes the charges.
  - **Winter** (December to March): road tiles on high ground (average corner height ≥ 2.75 — the passes) take 1.7×
    as long and a truck crossing one pays for chains. The era key includes the season, so ETAs and planners see it; the
    map turns snow-capped and the news says when the passes close and clear.
  - **Team drivers** (per truck, not vans): two drivers in a sleeper cab keep it rolling 35% quicker, at a second
    driver's pay per hour on the road (booked as wages). The answer to America's distances.
  - **Readable map**: town tags are placed most-important-first (your bases, then by population) and skipped rather
    than overlapped; show markers are laid out first (your bookings, then the richest offers), stacked out of each
    other's way, and zoomed out (below 0.75) a town's shows share one marker ("3 offers · £4.2k") that opens the town.
  - **Map views** (`render/renderer.ts` overlays, `territory.ts`): a Layers button (or O) cycles reputation by town,
    your market share, and rival territory. Shows played per town are tallied for you and every rival and fade
    each January (×0.6); towns get a tinted disc and their figure in a chip; markers step aside; a legend explains.
  - **Drivers' hours** (`infra.driversRules`): a solo driver's pace follows the era — +8% before the 1986 EU rules,
    baseline after, −10% with digital tachographs from 2007; in the US the 2004 and 2013 hours-of-service changes
    and 2017 electronic logs tighten it step by step. Team drivers are unaffected. The news announces each change.
  - **Historic disruptions** (`content/disruptions.ts`): about 25 real strikes, blockades, storms and the 2010 ash
    cloud, each with dates, an area or the whole country, and effects: road slow-down, fuel premium (even on a
    locked contract), extra border hours, or an air-freight rescue charge per booked show abroad. Part of the era
    key, so routes and ETAs see them; warned a few days ahead in the news.
  - **Venue character** (`venueTraits.ts`): stable per venue from its name, kind and country — load-in by dock,
    street or stairs (stairs: +1 crew on offers), curfews (late into one: a fine per tier and −5% quality), noise
    limits (strict in DE/CH/AT; audio beyond 1.4× the need trips the limiter: −4%), union houses (most US theatres
    and arenas, some British theatres: a call per head per show).
  - **Rail and air freight** (`freight.ts`): send a booked show's kit from a base by rail (terminals in towns and up)
    or air (cities); it counts if it lands before load-in, local freelancers crew it, and it returns after
    load-out as a transfer.
  - **National rules** (`rules.ts`): Spain's fiesta season (Jul–Sep: small towns offer ×1.8 as often, council-booked
    tier 1–2 shows pay 75 days late via the invoicing system, whatever your policy); France's intermittents (freelance
    rate ×0.75, pool ×1.5); Germany's Meister (from 1995 tier 3+ shows need one more certified rigger); Britain's 1998
    working-time rules (+1 relief crew on tier 3+ or multi-day shows); US right-to-work towns have no union houses
    or union crises, and Spain has no stagehand unions at all. Spanish rooms are strict about curfews (50–70%) and noise
    (30–35%). Rule flags live on the offer (`council`, `meister`, `relief`) and show in its window.
  - **Tour bus hire** (`buses.ts`): a business line independent of your shows. Touring acts post bus contracts
    (10–50 days, a day rate that scales with tier, country fee premium and the market); you reserve a parked coach
    (Duple 1975, Setra 1985, Skyliner 1994) and it leaves on the start date, earning the rate less a 30% driver share,
    wearing 0.06 reliability a day and breaking down now and then (4% of the bus's price). Open contracts can be
    taken by rivals (12%/day) or lapse. A finished tour raises the act's regard for you and your reputation a touch.

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

- **Auctions** (`auctions.ts`) — a bankrupt rival's racks and trucks (and, ~10% of months, an
  estate sale or hire-shop closure) go to a 21-day Dutch auction: gear lots (era-standard kit at
  45-80% condition) and used trucks (2+ years old, shakier). Asking price starts at 95% of market
  value (1.5× resale) and slides 3 points a day to a 70% floor — never below what the kit would
  resell for, so no arbitrage — but each day another buyer may snap each lot up (2% rising to ~7%).
  Used kit blends its condition into what you own; used trucks keep their age and reliability.

- **Price wars** (`pricewars.ts`) — monthly (~5%, ≤2 at once) a healthy rival based within ~35 road
  tiles of a town you have a depot in starts undercutting it by 8-20% for 2-4 months. Fees there
  fall by that much and the rival wins 30% more of the work; a decision offers ride it out (free; the
  war costs the rival 2 health a month), fight back (marketing-scaled spend: you only lose half the
  undercut, the rival loses 5 a month and gets no bonus) or buy a truce (twice the price, ends it
  at once). A rival below 35 health backs down. The Market window lists live wars.

- **Going public** (`shares.ts`) — from year 4 with reputation 55+, company value 1.5M and no red
  months, Finance offers a float of 30% of the company (7% underwriting fee) — cash lands under the
  new "Shares & dividends" ledger line, which is excluded from profit, awards and the annual report.
  Shareholder *confidence* (0-100, starts 60) moves monthly: +1.5 for a profitable month, −3 for a
  loss, plus the dividend policy (none −1 / modest 20% of profit +0.5 / generous 40% +1.5). The share
  price is company value × (0.7 + 0.6 × confidence). Below 30 an activist decision appears
  (special dividend +25 confidence, or stand firm −10 and reputation −2); under 8 for four months
  the board ousts you (game over). Going private again costs 120% of the stake's market value.

- **Facility upgrades** (`annexes.ts`) — warehouses now grow through four sizes (a fourth
  "production campus": 2,000 units, 28 prep / 10 office staff, £5,200 rent, reputation tier 4) and
  take annexes, each needing a minimum warehouse size and charging monthly upkeep:
  *rehearsal stage* (room 25k / soundstage 70k / production hall 160k / arena hall 320k, upkeep
  £400-5,000): rehearse a booked show (5% of its fee) or a whole tour (60% of its legs' combined
  cost) for +2/4/6/8% quality and −6/12/18/24% failure chance (×0.8 share across a tour), taking the
  stage for a day or more; free time is rented to bands (£350-6,500 a month × the economy × the
  town), and a busy stage keeps the town warm. *Workshop bench* (18k / 55k): +0.08 / +0.18
  condition a day to all kit (caps 85/95; more benches add 30%), on top of the workshop policy.
  *Crew lounge* (12k / 35k): techs resting at the base shed 3 / 6 extra fatigue a day (the second
  level adds a little morale). The base diorama grows a soundstage annex with a band, lighting bar
  and (from the production hall up) a video wall. A shutdown zeroes the rent but leaves the upkeep.

- **Corporation tax** (`tax.ts`) — found by the balance pass below. On 31 December the year's
  trading profit (everything except share dealings and asset sales, with only half of what you spent
  on trucks and kit counted as a cost) is taxed 15% on the first 250k and 30% above, after any
  losses carried forward. Booked as "Corporation tax"; the Briefing warns from October.

- **Balance pass (smart bot)** — a script that plays competently (buys gear for the shows it
  books, adds trucks and crew, takes tours and sponsors, answers decisions, builds a rehearsal stage,
  trains riggers/first-aiders, factors invoices when short) on GB 1995, 9 years, 3 seeds: with only
  gear and expansion it reaches ~7M company value; with the new systems ~14M (rep 80-100 instead of
  40: the rehearsal stage unlocks the big shows) — before tax; with tax ~11-12M. Earlier eras land
  at 5-11M in nine years. The economy is generous to competent play, so the "empire" goal moved from
  5M to 15M in 20 years; the dumb bot (which never expands) is unchanged. One run (ES 2010 seed 2)
  went bust in the 2010 slump after over-buying — early over-expansion in a crisis still bites.
  The script lives in `src/world/__bench__/smart.bench.ts` (`npm run balance`; see its header for the
  options). The dumb bot loses about 10% of its cash to the tax and keeps every run alive.

- **The briefing** (`advisor.ts`, Briefing window) — a read-only list of what needs doing, sorted red /
  orange / blue, each with a way into the problem: decisions pending and rival poach offers; booked
  shows within 4 days with no vehicle, within a week still needing a rehearsal, or needing tickets
  you have no one for; cash under a month (red) or 2.5 months (orange) of fixed costs (rent,
  salaries, crew pay, insurance, loan interest); an uninsured fleet; expensive loans you could
  clear; overdue or unreliable vehicles; worn-out crews; a sponsor you're about to miss this month;
  bases that would fail August's pre-audit; a fuel spike with no contract; offers expiring within
  a day; spring festival planning; and the missing rehearsal stage. The toolbar button badge counts
  the red and orange ones.

- **Disputes, claims and audits** (`disputes.ts`, `audits.ts`, `incidents.ts`) — three ways money
  and rules push back. *Promoter disputes*: a show under 62% quality at a tier-2+ venue may leave
  the promoter holding back 25% of the payout (chance 20% + 1.6 per point under 62%, −4% a
  relationship point); settle (take 40% of it), argue (55% they pay in full, else it's gone and the
  relationship cools) or send lawyers (16% of the held amount up front, 70% win; a loss costs 1
  reputation). *Insurer disputes*: a claim over 1,500 is questioned 22% of the time — accept half or
  fight (8% fees, 60% paid in full). *Premiums*: each claim in the last year loads the premium 8%
  (max +60%); two clean years earn −10%. *Safety audits*: each September the council scores every
  base older than four months (60 + prep ratio × 20, −20 over capacity, +10/+15 for first aiders on
  site, +4 each for a lounge and a bench, ±10 luck): 70+ passes with a little reputation; 45-69
  is an improvement notice (fix 4% of the base's build cost, appeal 1.5% for 40% to overturn,
  or pay a 7% fine and mark your insurance record); under 45 a prohibition (fix 8%, or shut for
  a week: 15% fine, −3 morale, −1 reputation). The Base tab shows the likely score and why.
  Legal fees and fines land in a new "Legal fees" ledger line.

- **Speciality** (`expertise.ts`) — a moving average of the department mix of the shows you play
  (each show moves it 4-10%, bigger shows more) sets 160 expertise points to share between five
  departments (each caps at 100). A show's fee is adjusted by 12% × (how well its needs match your
  expertise − an even mix): about +8% for a pure specialist on a show that leans on their
  department, −4% for an off-speciality job, 0 for an all-rounder. You're "known for" a department at
  60+. The Finance window shows the bars; the show window shows the adjustment, and the news line
  names it. The bot gains ~3% from its natural mix drift.

- **Getting paid** (`receivables.ts`) — pubs and clubs (tier 1) pay on the night;
  tier 2 takes 14 days, tier 3 30, tier 4 45, festivals and events another 15. Until then the money
  is an invoice ("Owed to you" in Finance, counted in company value). Each invoice has a small
  default risk (0.8% / 1.5% / 2% by tier; ×2 in a downturn, ×3 in a shutdown) rolled when it falls
  due. The *Invoices* policy: wait for it (carry the risk), sell to a factor (cash now for 96.5%)
  or credit insurance (1.2% premium; a default is covered). The bot loses about 2% of cash to the
  delay and keeps all its survival.

- **Tour merchandise** (`merch.ts`) — before a booked tour's first date (3+ days out) you can order
  stock: a small run (5% of the tour's fees), a proper range (10%) or the full stand (18%). Stock
  is worth three times its cost at the stands; demand is the played dates' fees × the act's pull
  (6% for local bands, 15-30% for real names by their tier) × how well tickets went × show quality
  × a little noise. You keep 60% of what's sold; unsold stock fetches a quarter of its cost.
  Settled when the tour ends (even if dates were dropped, on what was played). So a small run
  almost always profits, the middle order wins on a good tour, and the full stand only pays on a
  sell-out. Booked under the new "Merchandise" ledger line.

- **Tickets and the training academy** (`certs.ts`) — shows from tier 3 are inspected: tier 3
  wants one rigging-ticketed and one first-aid-trained person aboard, tier 4 two riggers and a
  first aider. A missing rigger costs 4% quality and 12% more kit failures; a missing first aider 6%
  more failures; each missing ticket is a fine of 5% of the fee. People in the hiring market arrive
  with tickets by a deterministic hash of their id (stage hands rigger-qualified over half the
  time) and crew selection favours ticketed people on the big shows. Anyone at base can be sent on
  a course (rigging £900 / 5 days, first aid £350 / 3 days; they can't be loaded meanwhile). The
  *training room* annex cuts course fees 30% and days 40%; the *academy* halves fees, cuts days
  60% and graduates a free apprentice (60% with a ticket) every quarter. Ticket chips show on every
  crew row and the show window lists what a show needs and what you have.

- **Fuel prices** (`content/economy.ts`, `market.ts`) — diesel has a price index (1.0 = a normal
  year) joined between real-history anchors: the 1979-81 plateau, the early-1986 collapse, the 1990
  Gulf blip, the 1998 low, 2008's spike, 2020's trough and 2022's surge. It multiplies every fuel
  cost (the sim, job estimates and the run planner). News breaks when a three-month swing crosses
  ±15%. A fuel contract (Market window) locks today's price plus 8% for 6 or 12 months — worth it
  before a spike, a waste before a slide. The index averages about 1.07 over 1975-2024, and the
  bot (which drives short local runs) barely notices.

- **Mandatory rehearsals** (`annexes.ts`, `standing.ts`) — bigger jobs can't be booked without a
  rehearsal stage of the right size, and then must go through it: arena shows (tier 3) need a
  rehearsal room, stadium shows (tier 4) and broadcast events a soundstage, national tours a room /
  soundstage / production hall by their biggest date (tier 2 / 3 / 4), world tours and overseas legs a
  production hall. Festival stages are exempt. The booking bar reports the missing stage (and a
  show less than three days out is "too late to rehearse"). A required show that reaches its date
  unrehearsed loses 10% quality and fails 30% more often; reminders arrive a week and three days out,
  or set the *Rehearsals* policy to automatic and they're booked for you in the fortnight before the
  first date if the stage is free and you can pay. A rehearsal needs a free stage at least as big as
  the requirement. Effect on the bot: shut out of arena shows, GB 1995 over 9 years ends ~5% poorer;
  GB 1979 over 7 years is unchanged.

- **Rivalry** (`rivalry.ts`) — each rival carries heat (0-100) toward you. It rises 12 when you
  headhunt them, 8 when you fight their price war (−5 for a truce), and each month by 4 × their
  grudge (a stable 20-90% per rival) if their HQ is within 35 road tiles of a base of yours; it
  cools 3 a month. From 35 up they play dirty (up to 35% a month, one at a time): rumours
  (reputation −2), tampered racks (a product's condition −30) or a council tip-off (next show −5%
  quality). A decision: security (stops it, −8 heat), hit back (55% you expose them for −8 finances
  and −15 heat; otherwise it backfires, +10 heat and −1 reputation, and the trick lands) or ignore.
  An investigator (one-and-a-half months of marketing spend) shows the heat and grudge for 90 days
  and makes that rival take 40% fewer of your offers; 20% of the time they're caught (+8 heat,
  reputation −1). Monthly rolls use a side rng.
  Balance: over 6-9 year bot runs (the bot never answers decisions) it shaves a few reputation points
  by the end — about 5 on GB 1995 over 9 years — and leaves cash and survival alone; GB 1979 over
  7 years is unchanged.

- **Sponsors and charity** (`sponsors.ts`) — once you have reputation 25+ and 10 shows behind you,
  each month there's a 10% chance (+0.2 points per goodwill) that an invented era-appropriate brand
  (a lager, a cola, a bank, a fuel firm, telecoms, tech…; one per category, two at a time) offers a
  12-month retainer of (500 + 30 × reputation) × fleet/3 × goodwill bonus a month, for a promised
  1.5 shows a month per vehicle. Sign, push for +20% (40% they walk) or decline (the default).
  Miss the show count and no retainer is paid; two months running and they walk (reputation −1,
  goodwill −10). Separately, ~4% of months a charity asks for a free benefit night (full production:
  goodwill +15, reputation +0.8, town +4; basic rig: half price, +6). Goodwill decays 1 a month. These
  monthly rolls use a side rng, so they don't disturb the rest of the sim.

- **Technology waves** (`content/techWaves.ts`) — formats come and go: moving lights (1986, dates
  PAR cans), line arrays (1996, point-source PA), moving heads over scanners (1998), digital desks
  (2000, analogue consoles) and LED over projection (2008). Each is rumoured two years ahead,
  arrives with a news item, and ramps over 4-8 years to its full effect: obsolete kit loses 25-35%
  of its quality on shows at the wave's minimum tier and up (tier 3, or 2 for scanners), and its
  resale value (and so company value) slides by 35-50%. The Market window lists each wave and how
  many of your units it hits. New games starting after a wave don't replay its news.

- **Owned venues** (`owned.ts`) — pubs, halls, clubs, theatres and arenas can be bought (venue
  window) with a base in town and the reputation to book there: £90-450 a seat plus 8% fees. Lease
  it out (0.9% of value a month) or promote it yourself (1.9% × the economy × your standing in
  town, ±50% noise) against 0.35% upkeep; condition (50-80 at purchase) wears 1.2 a month, scales
  income (0.6-1.0×, nothing below 12) and below 40 raises a refurbish / patch / defer decision. An
  owned room keeps the town warm (+0.5 rating a month). Selling gets 55-95% of value by condition.
  Net yield is ~6% a year leased and ~18% promoted — slower than a good fleet, so it's a place for
  surplus cash, not a snowball.

- **Your own festival** (`ownfest.ts`) — until the end of April you can promote a festival of
  your own from one of your bases (Market window): a field day (3,000 heads, reputation 35+), a
  weekender (15,000, 55+) or a major (50,000, 72+), a headliner (local / a big name / a global
  star) and a ticket price (cheap / fair / premium). Everything is paid up front — set-up, per-head
  production (your fleet trims it 5% a vehicle, to 30%) and the headliner. Two days out a weather
  decision offers covered stages; on the day attendance = capacity × (0.5 + 0.5 × brand/100) ×
  headliner draw × ticket demand × the market × your standing in the town × noise, with an 18%
  storm (×0.4, or ×0.75 if covered). A shutdown cancels it and returns 40%. Attendance ≥ 90% adds
  9 festival brand, ≥ 70% adds 4, < 50% costs 5, so first editions lose money and a built brand
  sells out. The "Headline promoter" milestone rewards a sell-out.

- **Headhunting** (`headhunt.ts`) — every rival carries a standout tech (3★, 4★ at reputation 55+,
  5★ at 80+; the department is the rival's specialty), stable within a month and drawn from a side
  rng so the sim's sequence isn't disturbed. Luring them away costs triple the normal signing fee,
  knocks 6 off the rival's finances and 1 off your reputation, and the star arrives expecting a
  15% pay rise. Each rival can be raided once per 180 days. Buttons sit under each rival in the League.

- **The world moves** — landmark rooms keep their real years (`content/venueYears.ts`): The O2
  opens in 2007, Wembley is shut 2001-2006, Palau Sant Jordi opens in 1990, the Stade de France in
  1998, Roig Arena in 2025… A closed room gets no offers, tour dates, festival sites, event lots or
  house tenders, and the New Year news announces openings, rebuilds and reopenings (world tours
  need an open home room). **Local fame**: towns you've done proud (rating above 50) post up to
  +20% more offers, towns you've let down −20%.

- **Living rivals** (`rivals.ts`) — monthly: well-run firms (health 60+) build their name slowly and
  move up a tier when their standing allows (news: "now chasing arena-size work"), struggling ones
  (<35) lose it; a healthy firm (65+) may swallow a struggling one (<25) — the buyer inherits its
  reach, the target's base closes and its lot frees up; and in a decent era market (trend ≥ 1,
  never in a shutdown) a new start-up opens in a town with a free lot — small (tiers 1-2, rep
  12-24) with a made-up name. Capped at 14 firms.

- **The long game** (`milestones.ts`) — every New Year the **annual report** closes the books (revenue,
  costs, net, company value, shows and average quality, league rank among all firms, fleet and
  crew), compares with last year in the news and sits in the Finances window (last three years
  side by side). 25 career **milestones** (first show, 100 shows, first tour, festival, special
  event, house contract, own product, takeover, 5★ tech, first profitable year, seven then eight
  figures, a decade in business…) tick off monthly and show in the League; pure recognition, no
  economic effect.

- **Maker partnerships** (`partners.ts`) — from reputation 25, commit a department to one maker
  (Meyer for sound, Martin for lights…): 10% off their kit, and a monthly sponsorship of
  `share × (150 + reputation × 6)` while ≥50% of that department's racks wear their name. Below
  that they warn you for two months, then walk. A partner can't be swapped inside a year.

- **Haggling** (`negotiate.ts`) — any single-show offer (not tours, festival or event tenders) can be pushed
  once for +12% fee. Odds are 15-85%: your standing beyond what the act demands, the town's opinion,
  your history with the act, and whether they asked for you by name. If they refuse, half the time the
  promoter also walks and books someone else — so it only pays when you hold the stronger hand.

- **Growing towns** (`towns.ts`) — every month each town grows by 0.15% plus the era's boom or
  bust, extra where you run a base (+0.15%) and have a name (up to +0.2%); nothing during a
  shutdown, capped at 2.5×. Population shows in the Towns window ("+x% since you started"), and the
  town's offer rate scales with it.

- **World tour map** (`ui/worldMap.tsx`, `content/worldmap.ts`) — a stylised world (hand-simplified
  continents, real coordinates for every overseas city, a home airport per country). Flight arcs run
  from your home airport to each overseas leg, stops are numbered along the leg and turn green as
  they're played, the next date pulses, and the way home is dashed. "Whole tour" frames the lot; each
  leg button zooms to its region with city names. Reached from the tour window, the globe in the
  toolbar, or the menu on phones.

- **Customs** (`dilemmas.ts`) — an overseas leg has a 25% chance of trouble at load-in, most often a rig
  held at customs: hire a broker (3% of the fee), release it minus the flagged cases (thinner show),
  or sit it out in the shed (rushed, tired show, morale dips).
- **Promoter relationships** (`promoters.ts`) — each venue's promoter remembers your nights: great shows
  (+1), solid ones (+½), bad ones (−1), disasters (−3), 0-8. Friendly promoters get picked for offers
  more often (+25% weight per point) and pay up to +10%; shown as "Strangers → Family" in the venue window.
- **Suggested next jobs** — the vehicle window lists up to three open offers that fit on the end of a
  truck's orders (bookable, reachable before load-in, within 36 tiles), best fee for the driving first,
  with a one-tap Book & assign.

- **Choosing the crew** — on a booked show, name exactly who goes (up to the crew it needs): named
  people board first, even over better-matched techs, and are held back from other booked shows;
  the gig window shows the crew fit.
- **Truck itinerary** — each order in a vehicle's list shows the distance (km or miles) from the previous stop and
  the hours spare at load-in (green 6h+, amber under 6h, red if late), plus the way back to depot.
  (Orders stay sorted by show date, so there's nothing to drag into order.)
- **Visas & carnets** (`paperwork.ts`) — a rig that crosses a border pays an ATA carnet (£400 +
  0.3% of the kit's value + £120 per extra country) unless it stays inside the EU (the UK needs
  carnets for Europe from 2021), and a work visa per head for the US, Canada, Japan, Korea,
  Australia, Singapore, Brazil (rising over the decades). Estimated on the world map and in the road
  costs, charged when the rig turns up, whatever the show's result.

- **Run planner** (`runs.ts`, `ui/planner.tsx`) — pick a truck, tick open offers in its reach (up to 2.5× the
  suggestion range) and see the whole run before committing: tiles on and hours spare at every load-in
  (the plan is checked as if the truck already had those orders), fees, driving and fuel, nights away
  and a net. Booking is all-or-nothing (book + assign each date, or none). A run of 2+ dates earns a
  **run bonus** of 3% per extra date (cap 12%) of the fees, paid when every date is played with
  quality ≥ 60%; one failure or rough night and it's forfeited ("Run bonuses" in the ledger).
- **Crew on the road** (`dilemmas.ts`) — each day a 3★+ person aboard a truck with a show ahead may ask for
  a raise (1.2% × a morale factor; not while "loyal"): accept (+15% pay for good, loyal six months), a one-off
  bonus (twelve days' pay, loyal two months — the default if ignored) or call their bluff (they walk,
  leaving the crew a person short). Someone at 75+ fatigue may burn out (4%/day): send them home or push
  through (a rougher show, morale dips). One open question per person.

- **Fleet dashboard** (`fleetReport.ts`) — the Fleet window opens on KPIs (vehicles, busy %, on the road, idle,
  reliability, average age, the next 14 days covered, profit YTD), a "Needs attention" list (booked shows with
  no truck, that won't make load-in, or short on gear/crew; broken or overdue-for-service or low-reliability
  trucks; vehicles past their life; trucks that have barely worked) and every vehicle with a usage bar
  (an exponential average over ~50 days of working-or-booked days), sortable by profit, busiest, oldest, name.
- **Rivals at auctions** — lots are now bought by named rivals (healthy ones only, weighted by health, a match
  with their department, and how near their base is); news says who picked up what, and a buyer's books get a
  small lift. Nobody buys when every rival is struggling.
- **Rivals plan runs too** — a rival already holding a date within 24 tiles and 4 days of an offer is 1.45×
  likelier to land it (1.15× more again with two or more dates nearby), and puts it on the same truck when
  there's time to drive between (a day apart at most 8 tiles, otherwise 2+ days); news: "X strings Y onto its run".

- **Low-emission zones** (`content/regulations.ts`, `regulation.ts`) — from their start year cities charge vehicles
  below an emission class a daily fee (London LEZ 2008 and ULEZ 2019, Germany's Umweltzonen 2008, Paris 2015+,
  Milan 2008, Madrid Central 2018, LA 2010, …). A vehicle's class is what it met when it was built (a 1992→1…
  2014→6 ladder) plus up to two retrofits (12% of the model's price each, done at the depot). Charged per show
  day when the truck is on site, shown in the job estimate, as fleet-dashboard alerts and in the Market window's
  zone list, and announced when a new scheme starts.

- **Marketing & trade shows** (`marketing.ts`, `content/tradeShows.ts`) — a standing marketing policy (none /
  local ads / trade press / national campaign: 0 → 0.25 → 0.6 → 1.4 × (400 + 20 × reputation) a month) buys
  +4% / +9% / +16% offers and a slow reputation climb that fades toward 100. Each year PLASA (London, Sept),
  Musikmesse then Prolight + Sound (Frankfurt, spring) and LDI (Las Vegas, Nov) ask a question on opening
  day (not during a shutdown): take a stand (+25% offers for 30 days, 12% off kit for 14, a little
  reputation), walk the floor (+8% / 14 days, 5% / 7 days) or stay home (the default). Costs scale with your
  size and the distance (×1 at home, ×1.8 across Europe, ×3 overseas); kit discounts stack with partnerships.

- **Goals, difficulty & legacy score** (`scenario.ts`) — pick a goal and a difficulty when you start. Goals:
  sandbox, top of the industry (reputation 90 in 25 years), an empire (worth £5M in 20), around the world (three
  world tours in 25), silverware (Production Company of the Year ×3), the consolidator (buy out three rivals in
  25) and built to last (30 years). Progress shows in the League; reaching it is a big news moment and the
  game carries on; missing the deadline is noted. Difficulty: Gentle (1.6× starting cash, rivals ×0.8, crises
  ×0.7, five months in the red), Standard, Cutthroat (0.7× cash, rivals ×1.25, crises ×1.3, two months). The
  **legacy score** sums the career (company value, reputation, shows, awards, milestones, years, a won goal ×1000),
  scaled by difficulty, and shows in the League and on the game-over panel.

- **Front door** (`ui/Splash.tsx`, `ui/Intro.tsx`) — the game opens on a title screen (stage-light beams, the
  title truck in your livery) over the map: Continue (with company, date, cash and goal of the saved game),
  New company, How to play. Starting a new company runs a four-card **intro** — the year and what the era was
  like (with the current market headline), your company and its kit, the competition, your goal and the first
  three steps — skippable, with a "skip next time" tick. The clock stays paused through both.

- **Fee or gate** (`gate.ts`) — on single shows of tier 2+ you can take a share of the gate instead of a flat fee:
  flat pays fee × (0.35 + 0.65·quality); the gate pays fee × (0.12 + 1.2·quality²·hype). `hype` (0.5-1.6) is how
  ticket sales go — the economy and season, the town's opinion of you, a real act — plus luck; you get a forecast
  (the truth ± 0.15) when you book, and the real number on the night. Over a year a decent crew comes out a few
  percent ahead on the gate, but it swings with the season (summer well ahead, mid-winter behind) and a rough
  night or slow sales leaves you well short.

**Balance check** (scripted bot: one local truck per idle van, GB 1979 / 1995, ES 2010, US 1985, 4-24 seeds
each, vs the merged #19 baseline). Cash and survival are level or better (GB 1979, 12 seeds: mean £1.02M
baseline vs £0.93M, 11/12 vs 12/12 alive; fresh seeds £924k vs £934k); reputation runs a few points lower
for a bot that never answers a decision — unanswered decisions take the free default, which costs a little
show quality. A smarter bot that plans 3-date runs, haggles at ≥60% odds, takes partnerships and answers
decisions earns about 2× the plain bot, almost all from keeping each truck booked (run bonuses paid on only
3-6 runs in 7 years; sponsorship is ~£500/month per department), so there's no runaway from the new tools.
A second pass after the rival changes: GB 1979 cash £863k mean (vs £926k before, £1.02M baseline), the other
three scenarios flat, no extra bankruptcies, show counts steady.
A third pass after emission zones, marketing, trade shows and goals: standard-difficulty results are identical to
the second pass in every scenario (the bot never uses those systems, and an unanswered trade show means
staying home). Difficulty tiers on GB 1979 over 8 seeds: Gentle £897k, Standard £846k, Cutthroat £732k mean cash
(7 of 8 Cutthroat companies survive, all of the others do).

UI: **Market** window (climate, season, festival calendar, rates), **Company policies** window
(workshop, pay, insurance), Shows → **Contracts**, condition/fatigue chips, failure risk in the
show forecast, rating and trophy cabinet in the **League**.

## 8. Not ported yet (and where each lands)

The retired dashboard build had systems that were ported to the map game like so:

| Dashboard system | Map-game home |
|---|---|
| Individual crew (skills, XP, avatars, hiring market) | Done: named people with skills, traits, XP, a hiring market (people.ts); avatars still to come |
| Crises (planning / execution prompts) | **Road incidents** (breakdown: wait, tow, or hire a local van), **show incidents** at the venue, both as TT-style pop-ups with choices |
| Show Day scene | Click a venue during a live show → zoom-in performance view (the scene from the game-feel plan, now reachable from the map) |
| Rentals | Local hire at the venue town when you're short — expensive, but saves a no-show |

## 9. Next steps (PR-sized)

1. **Playtest & balance pass** — fee/wage/running-cost tuning, offer density, rival aggression.
2. **Named crew** — done (`people.ts`), with pins, rest rota and counter-offers.
3. **Road & show incidents** — done (`dilemmas.ts`): breakdown and venue decisions.
4. **Tour planner** — route lines for the selected vehicle are drawn on the map (numbered stops) and the vehicle window suggests the next job; still to come: drag-to-order a show list,
   route lines drawn on the map for the selected vehicle.
5. **Gear transfers & local hire** — move stock between warehouses; hire locally when short.
6. **Sound** — WebAudio engine hum, crowd swell at live venues, cash-register on payouts.
7. **Town growth** — landmark venues now open and close in their real years and local fame
   steers offers; towns also grow over the decades (`towns.ts`).
8. ~~Retire `/classic`~~ — done: the dashboard build and its code have been removed.

## Historic scenarios

The new-company form offers seven one-year scenarios (`scenarios.ts`): Live Aid 1985, The Wall in Berlin 1990, Italia ’90, Barcelona ’92, Expo ’92, Atlanta ’96 and London 2012. Each fixes the country, start year and home town, gives an established small firm (reputation and cash enough to bid), and sets one goal (`GoalId` `scenario`): win a lot of the event's production and deliver it at quality 50% or better before the year is out. The event tender is the ordinary special-events engine (`events.ts`), so rivals bid against you and the night carries its usual prestige and stakes.

## The trade press

Every New Year (`charts.ts`) the press prints the supplier league table for the year just gone (your company rating against the rivals'), the year's biggest tours in your market (the acts at the top venue tier, with a ★ on any you carried) and reviews of your best and worst nights. A rave (quality 90%+) or a panning (a failed show, or under 55%) moves your reputation by 0.4, and each big tour you carried adds 0.3 (up to three). The latest charts sit in the League window under *Trade press*.

## Consequences you can read back

A set of systems that chain into each other, with the causes recorded so a failure can explain itself rather than read as random punishment.

- **Late payers** (`receivables.ts`): some promoters (8–16% by tier) pay 10–35 days after the due date, with a news warning. Credit-insured invoices never slip.
- **Deferred maintenance** (`consequences.ts`): a truck's service or the monthly workshop bill is put off when cash is under four times the bill. A truck past its service interval loses reliability twice as fast; a lapsed workshop stops repairing the kit. Each deferral is logged with *why* cash was short (invoices owed, how many are late, debt).
- **Explained breakdowns**: a breakdown lists its causes by weight (service overdue, age, wear, winter — or "just unlucky" if the truck was sound) and links back to the deferral that set it up. The truck's shows are tagged with the breakdown.
- **Post-mortems**: a failed or rough night gets an incident record naming its causes — late load-in, dead kit and the workshop lapse behind it, short or exhausted crew, left-behind cases, unpaid extras, venue limits — and the news line ends "Why: … It traces back: service deferred → …". The last eight are in the League window under *Post-mortems*. A failed or tired-crew night also dents crew morale, and a collapse costs goodwill with the act.
- **Change orders** (`changes.ts`): at load-in a client may ask for an extra hour, extra kit or an earlier soundcheck. Each client has a hidden temper (easy-going, reasonable, always pushing) that you only learn from history. You can do it free (goodwill now, but they ask more often), quote for it (they pay or refuse, by temper and what you have taught them) or hold to the contract (goodwill lost; this is what happens if you don't answer). Overtime tires the crew and unpaid extras go into the post-mortem if the night goes badly. The offer window shows your history with the client.
- **Cash forecast** (`cashflow.ts`): the Money window projects the next eight weeks from invoices (with default and late-payment risk), booked shows and the monthly bills, as an expected line with a range. The range is ±30% with no back office and narrows to ±8% with office staff. It warns when late invoices could leave you overdrawn, or too thin to pay for services.

## Technical riders

From club level up a show carries a technical rider (`techRider.ts`) with hard requirements, not just a brand preference:

- **Inputs**: the FOH desk must take enough channels — 24 at clubs, 40 in theatres, 56 at stadiums, half as much again after 2000 and more after 2010. Analogue desks top out at 40–48 inputs, so the big digital desks earn their price. (Desk input counts are in `content/consoles.ts`.)
- **Show file**: a real act at theatre size and up often brings its own engineer, whose show file runs on one digital console family (DiGiCo, Yamaha, Avid…).
- **Approved PA**: bigger shows list the two or three PA brands they accept.

Trucks load compliant kit first. The show window lists the rider and, once trucks are assigned, checks the kit going out; for each breach it offers **cross-hire** from a rental house (6% of the unit price a day, delivered to the venue). Break the rider and the engineer fights the kit all night (−8% quality per breach), the client withholds 12% of the fee per breach (up to 30%), the act's goodwill drops and the breach goes into the post-mortem. Owning one console family means fewer hires; mixing brands means hiring more often.

## Can the room take the show?

From clubs and theatres up (`production.ts`), every venue has a house power supply, a roof that takes so many tonnes (open-air stadiums: none) and, unless it has a loading dock, no access for artics. Every gear kind draws power and flies weight: a par-can rig drinks power that an LED rig doesn't, line arrays and video walls are heavy, and each staging unit brings 5 t of ground support for open-air shows.

- **The offer** says if a typical rig for the show would overload the room, and roughly what the fix costs — some jobs aren't worth it.
- **A booked show** checks the actual kit and trucks going out, with a button per problem: hire a generator, hire ground-support towers, or book local vans to shuttle the kit from where the artic can park.
- **Left unfixed**: the house supply trips (twice the chance of kit failing, −4% quality), half the rig stays on the floor (−8%), or the artics are hand-balled in (+2 h on the load-in). Each goes into the post-mortem as "The production didn't fit the room".
- The venue window lists each room's power, roof load and access. The old random "undersized power" crisis is gone: power is now something you can see coming.
