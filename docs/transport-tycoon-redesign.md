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
(`src/world/__tests__/*.test.ts`, 182 tests):

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

- **Auctions** (`auctions.ts`) — a bankrupt rival's racks and trucks (and, ~10% of months, an
  estate sale or hire-shop closure) go to a 21-day Dutch auction: gear lots (era-standard kit at
  45-80% condition) and used trucks (2+ years old, shakier). Asking price starts at 95% of market
  value (1.5× resale) and slides 3 points a day to a 70% floor — never below what the kit would
  resell for, so no arbitrage — but each day another buyer may snap each lot up (2% rising to ~7%).
  Used kit blends its condition into what you own; used trucks keep their age and reliability.

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
- **Truck itinerary** — each order in a vehicle's list shows the tiles from the previous stop and
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
4. **Tour planner** — route lines for the selected vehicle are drawn on the map (numbered stops) and the vehicle window suggests the next job; still to come: drag-to-order a show list,
   route lines drawn on the map for the selected vehicle.
5. **Gear transfers & local hire** — move stock between warehouses; hire locally when short.
6. **Sound** — WebAudio engine hum, crowd swell at live venues, cash-register on payouts.
7. **Town growth** — landmark venues now open and close in their real years and local fame
   steers offers; towns also grow over the decades (`towns.ts`).
8. **Retire `/classic`** once its systems are ported.
