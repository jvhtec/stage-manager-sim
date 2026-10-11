# Historical market architecture: implications from the Spain research

**Status:** architecture proposal attached to research PR #24.  
**Goal:** support historically grounded companies, managers, specialists, suppliers, promoters and ownership changes without turning \`RivalTemplate\` into a new god object.  
**Non-goal:** implement the whole historical system in this PR.

The Spain research has moved the problem beyond "fix a few rival entry years." The current rival model assumes that a company is a single permanent identity with one HQ, one specialty, one reputation band, generic all-department capacity, and a global founding year that doubles as local market entry. Historical evidence breaks all of those assumptions.

This document maps the research directly onto the current codebase.

---

## 1. Current architecture: where the historical model leaks

### 1.1 \`RIVAL_COMPANIES\` conflates identity, geography, chronology and operating presence

Current \`RivalTemplate\` contains:
- \`name\`
- \`countries\`
- \`enters\`
- \`renames\`
- \`exits\`
- one \`specialty\`
- tier/reputation values.

That is too much meaning in too little data.

The most damaging example is \`countries:['*']\`. \`rivalsFor(country)\` treats the template as locally eligible in every country, and \`updateRivals\` gives the actor a real local warehouse lot. A foreign supplier being able to work in Spain is therefore equivalent to having a permanent Spanish operating company.

### 1.2 \`specialty\` is a preference bonus, not a capability boundary

\`offerToRivals\` gives a 1.3 multiplier if the show's dominant department matches \`rival.specialty\`.

But \`opsOf\` creates:
\`\`\`ts
kit: Object.fromEntries(DEPTS.map(...))
\`\`\`
for **every** rival.

Result:
- a staging specialist owns audio;
- a lighting specialist owns video and stage;
- a pure PA house owns lighting;
- the historical partner/subhire market disappears.

Spain research specifically contradicts this. Fluge's founder described a market of specialist suppliers and Fluge using external lighting partners before internal diversification.

### 1.3 \`opsOf\` invents a mature company from tier + reputation

Current initialization derives:
- cash
- every department's kit
- one desk
- PA brands
- crew
- trucks
- condition

from \`maxTier\`, \`reputation\`, year and RNG.

This makes "Fluge, 1990" a scaled abstract company, not a 1990 sound-tour startup that later becomes an integrated AV group.

Historical entry and mature scale need separate concepts.

### 1.4 \`rivalReach\` uses global identity as a proxy for network reach

Current:
\`\`\`ts
const international = !!template?.countries.includes('*')
\`\`\`

That drives:
- border reach;
- team-driver behaviour;
- freight;
- foreign contacts.

This should be a dated operational capability, not a property of the corporate name.

A Spanish EML subsidiary in 2008 and a visiting Clair tour supplier are both "international" in different senses.

### 1.5 The offer model assumes one prime supplier owns the whole show

A normal \`Gig\` has one \`rivalId\`.

This is still workable, but the quote must be able to include **subcontractors/partners**. We do **not** need to explode every ordinary gig into one contract per department in Phase 1.

The better incremental model:
- one prime contractor remains the owner of the gig;
- \`RivalQuote\` returns a supply plan;
- missing business lines can be covered by preferred partner/subhire actors;
- costs and quality effects flow through the prime contractor.

Special events/festival lots can continue using their existing per-lot model.

### 1.6 Rival reinvestment currently pushes firms toward generic integration

When the most common decline is \`kit\`, \`monthlyRivalOps\` increases **all departments**.

Historical firms often did the opposite:
- stayed regional;
- remained specialists;
- pivoted from live production to distribution;
- outsourced lighting/staging indefinitely;
- shifted into installation/corporate AV.

Reinvestment has to follow strategy/business-line eras.

### 1.7 Random mergers destroy historical continuity

Current \`rivalMergers\`:
- deletes target;
- closes its base;
- transfers booked work;
- boosts buyer stats.

It does not preserve:
- staff;
- actual kit;
- local customer relationships;
- supplier links;
- operating base;
- brand/lineage.

Historical acquisition examples (EML→PRG, Gamerco→Live Nation, The Project→Warner) are specifically continuity events.

Random emergent mergers can still exist, but historical ownership events need a separate path.

### 1.8 Player takeovers synthesize generic gear instead of inheriting actual operations

\`absorbRival\` creates "a show's worth of era-standard kit" using \`rentalProduct\`.

Once historical rivals have meaningful actual inventories, this becomes incorrect.

A takeover should transfer the rival's modeled assets and liabilities.

### 1.9 \`MAX_RIVALS = 14\` and global crowding hide regional market density

Current chance includes:
\`\`\`ts
Math.min(1, 5 / state.rivals.length)
\`\`\`

Adding historically accurate regional actors would reduce everyone globally, including firms that are nowhere near the job.

Spain evidence shows several active suppliers in one city/region. Competition should be **local and capability-filtered**, not based on total national rival count.

### 1.10 Gear availability is mostly \`introYear\`

The catalogue knows when a product exists globally.

Historical research shows Spanish availability/support depended on:
- domestic manufacturers;
- importers/distributors;
- dealer relationships;
- local support;
- brand-specific rental ecosystems.

A 1986 Spanish company should not effectively have the same procurement graph as a US company.

### 1.11 Runtime state is small because content is mostly static

This is good and should be preserved.

Historical source metadata, biographies, legal dates and evidence **must not** be copied into saves. Runtime should store IDs and mutable operational state only.

---

# 2. Architectural boundary: four connected registries

Do not extend \`RivalTemplate\` until it contains the history of Western civilization.

Split static content into four related registries.

## 2.1 Company / organization registry

\`content/historicalCompanies.ts\`

Represents legal/operating organizations:
- rental houses;
- staging firms;
- integrators;
- distributors;
- manufacturers;
- promoters;
- logistics firms.

Suggested shape:
\`\`\`ts
type ActorRole =
  | 'technical-rental'
  | 'staging-rigging'
  | 'backline'
  | 'av-integrator'
  | 'manufacturer'
  | 'distributor'
  | 'promoter'
  | 'venue'
  | 'logistics';

interface HistoricalActorTemplate {
  id: string;
  homeCountry: CountryCode;
  homeCity?: string;
  homeRegion?: MarketRegionId;

  founded?: HistoricalDate;
  operatingEras: OperatingEra[];
  nameEras: NameEra[];
  ownershipEvents?: OwnershipEvent[];

  sourceRefs: SourceRef[];
}
\`\`\`

The actor identity persists across name/ownership changes.

## 2.2 People registry

\`content/historicalPeople.ts\`

Separate:
- owner/manager;
- technical director/system engineer;
- promoter/buyer;
- distributor/manufacturer leader.

\`\`\`ts
interface HistoricalPerson {
  id: string;
  name: string;
  tenures: {
    actorId: string;
    role: HistoricalRole;
    from?: number;
    to?: number;
    sourceRefs: SourceRef[];
  }[];
}
\`\`\`

No AI personality stats live here.

## 2.3 Supplier / technology registry

\`content/suppliers.ts\`

Represents:
- manufacturers;
- distributors;
- local support/import relationships;
- brand availability by era.

Examples:
- Musicson;
- Ecler;
- Beyma;
- DAS;
- Stonex;
- Magnetron;
- Earpro;
- Equipson;
- later SeeSound etc.

This registry should map brands/products to country/era availability modifiers rather than duplicate \`GEAR_PRODUCTS\`.

## 2.4 Client/promoter registry

\`content/promoters.ts\`

Represents repeat buyers and demand generators:
- Gay & Company/Gamerco;
- Doctor Music;
- Tratos;
- The Project;
- Last Tour;
- public authorities/frameworks;
- broadcasters.

Promoters should create offers/tours and supplier preferences. They should not be inserted into \`state.rivals\`.

---

# 3. Static historical facts vs fictional simulation strategy

This separation should be enforced in types.

## Historical content
Source-backed:
- company exists;
- HQ;
- business line;
- ownership event;
- manager tenure;
- known technology relationship;
- documented fleet purchase;
- known acquisition/closure.

## Strategy content
Game design:
- debt tolerance;
- client retention;
- regional stickiness;
- investment horizon;
- package-integration preference;
- willingness to subcontract;
- price aggression.

\`\`\`ts
interface RivalStrategyEra {
  actorId: string;
  from: number;
  to?: number;
  strategyId: RivalStrategyId;
}
\`\`\`

A strategy may be inspired by documented company behaviour, but remains explicitly simulation tuning.

This prevents a historical manager from becoming an unsupported psychological profile.

---

# 4. Operating eras: the key abstraction

A company needs to change over time without becoming a new rival ID.

\`\`\`ts
type BusinessLine =
  | 'audio'
  | 'lighting'
  | 'video'
  | 'staging'
  | 'rigging'
  | 'backline'
  | 'corporate-av'
  | 'installation'
  | 'distribution';

interface OperatingEra {
  from: number;
  to?: number;

  localPresence: CountryCode[];
  roles: ActorRole[];
  businessLines: BusinessLine[];

  scale: 'micro' | 'regional' | 'national' | 'international';
  targetTiers: [number, number];

  networkReach?: 'local' | 'regional' | 'national' | 'touring-europe' | 'global';
  strategyId?: RivalStrategyId;
}
\`\`\`

Examples:
- Fluge 1990: audio, regional/national, small.
- Fluge later: audio+lighting+video, national/international, integrated.
- Soinua pre-2015: live technical production.
- Soinua post-2015: distribution-heavy, reduced rental competition.
- Sono: corporate AV/integration, not generic arena PA.
- EML Spain 2006: local Spanish technical-production subsidiary.
- PRG 2011+: same operation, changed ownership/network.

---

# 5. Presence needs three modes

Replace \`countries:['*']\` semantics.

## 5.1 Local operating presence
Has:
- depot/base;
- local overhead;
- local staff;
- territorial share;
- ordinary local bidding rights.

## 5.2 Visiting tour supplier
Has:
- no local depot;
- only attached to a specific tour/artist;
- freight/travel costs;
- may subhire local stage/light/labour;
- no normal municipal/local offer stream.

## 5.3 Cross-border / network supplier
Can bid selected work from abroad or another domestic region:
- higher freight cost;
- lower local relationship score;
- may have international brand/client access.

Suggested runtime:
\`\`\`ts
type PresenceMode = 'local' | 'visiting-tour' | 'network';

interface ActorPresence {
  actorId: string;
  mode: PresenceMode;
  country: CountryCode;
  cityId?: string;
  sinceDay?: number;
  untilDay?: number;
}
\`\`\`

Do not create a warehouse for \`visiting-tour\`.

---

# 6. Runtime rival structure: keep saves lean

Static chronology should remain content-derived.

Suggested runtime:
\`\`\`ts
interface Rival {
  id: string;                 // runtime identity
  actorId?: string;           // historical template id, undefined for fictional startup
  lineageId?: string;         // survives rebrands/ownership changes
  displayName: string;

  hqCityId: string;
  lot: number;

  reputation: number;
  health?: number;
  showsPlayed: number;

  strategyId: RivalStrategyId;
  ops?: RivalOps;
}
\`\`\`

Historical source metadata remains outside the save.

---

# 7. RivalOps should model owned capabilities, not universal departments

Current \`kit: DeptCounts\` implies every department exists.

Change toward:
\`\`\`ts
interface RivalOps {
  cash: number;
  owned: Partial<Record<Dept, RivalDepartmentOps>>;
  crewPools: Partial<Record<CrewDept, number>>;
  trucks: number;
  // ...
}

interface RivalDepartmentOps {
  capacity: number;
  quality: number;
  preferredBrands?: string[];
}
\`\`\`

This makes:
- zero lighting ownership meaningful;
- staging companies legitimate;
- audio-only firms possible;
- integrated firms expensive rather than default.

Console/PA detail can remain in audio substate.

---

# 8. Partner/subhire graph: minimum viable design

Do not split every \`Gig\` into multiple contracts yet.

Extend \`RivalQuote\`.

\`\`\`ts
interface RivalSupplyPlan {
  owned: Partial<Record<BusinessLine, number>>;
  partners: PartnerAllocation[];
  marketSubhire: MarketSubhire[];
}

interface RivalQuote {
  ok: boolean;
  reason?: DeclineReason;
  cost: number;
  crossHires: number;
  fixes: number;
  supplyPlan: RivalSupplyPlan;
}
\`\`\`

Quote sequence:
1. satisfy from owned capability;
2. try preferred historical/current partners;
3. try open subhire market;
4. decline if price/capacity/risk threshold exceeded.

Relationship:
\`\`\`ts
interface SupplierRelationship {
  buyerId: string;
  supplierId: string;
  line: BusinessLine;
  trust: number;
  preferred: boolean;
  sinceDay?: number;
}
\`\`\`

Repeated successful partnerships can improve:
- availability;
- coordination;
- quote speed/cost;
- quality.

This directly supports the documented early-Fluge operating model.

---

# 9. Capability and strategy must affect bidding before RNG

Current bidding:
- chance roll;
- then \`rivalTryTake\`.

Future bidding should first build an **eligible actor set**.

\`\`\`ts
const eligible = activeActors
  .filter(a => canReach(a, gig))
  .filter(a => canPrimeOrAssemble(a, gig))
  .filter(a => clientWillCall(a, gig));
\`\`\`

Then probability/ranking is applied.

Benefits:
- a staging-only firm cannot accidentally win a full sound tour;
- a local lighting company can be a subcontractor;
- crowding is measured among actual candidates.

---

# 10. Replace global crowding with local eligible-market density

Current:
\`\`\`ts
5 / state.rivals.length
\`\`\`

Proposed:
\`\`\`ts
marketCrowding(gig, eligibleActors)
\`\`\`

Use:
- city/market region;
- business line;
- tier;
- reach;
- current availability.

A dense Valladolid regional market should affect Valladolid work, not suppress a Barcelona supplier's probability of winning an unrelated contract.

---

# 11. Regional historical actor pools

Spain has too many real firms to spawn all of them.

Use:
- mandatory national/historically central actors;
- deterministic regional pools;
- fictional startups around them.

\`\`\`ts
interface HistoricalActorPool {
  id: string;
  country: CountryCode;
  region: MarketRegionId;
  from: number;
  to?: number;
  actorIds: string[];
  minActive: number;
  maxActive: number;
}
\`\`\`

At new-game creation, select a deterministic roster using \`mapSeed\`.

### Important save rule
Store the selected historical actor IDs:
\`\`\`ts
marketRoster?: string[]
\`\`\`

Why:
- if historical content is corrected in a later version, an old save should not suddenly receive/remove rivals because a static pool list changed.

Migration:
- old saves derive roster once;
- new saves persist it.

---

# 12. Region mapping should be content-derived, not manually saved

The generated world already uses real cities.

Add a static lookup:
\`\`\`ts
marketRegionForCity(country, cityName)
\`\`\`
or extend the static geo-city content with a \`marketRegion\`.

Examples Spain:
- madrid-central
- catalonia
- asturias
- basque
- galicia
- castilla-leon
- valencia
- andalucia
- balearic
- canaries

Because the map is derived, region tags do not need save migration.

---

# 13. Supplier network and gear availability

Keep \`GEAR_PRODUCTS.introYear\` as global technical availability.

Add procurement context:
\`\`\`ts
interface ProductMarketAccess {
  productId?: string;
  brand?: string;
  country: CountryCode;
  from: number;
  to?: number;
  distributorId?: string;
  availability: number; // not necessarily hard 0/1
  support: number;
  priceFactor?: number;
}
\`\`\`

Possible effects:
- purchase price;
- lead time;
- used-market frequency;
- support/repair speed;
- rider confidence;
- chance a rival chooses that brand.

Do not make historical distributor relationships arbitrary hard locks unless evidence supports exclusivity.

---

# 14. Historical equipment events

Some purchases are sourceable and can be explicit:
- Use Sonido 2014 Meyer LYON package;
- Sorter EAW/L-Acoustics eras;
- Twin Cam premium PA transitions.

Represent as optional content events:
\`\`\`ts
interface HistoricalFleetEvent {
  actorId: string;
  year: number;
  products?: Record<string, number>;
  brandShift?: string[];
  sourceRefs: SourceRef[];
}
\`\`\`

Runtime rule:
- if the historical actor survives and can afford it, strongly prefer the documented event;
- if simulation history diverged catastrophically, do not conjure free equipment from the void.

The history should bias, not override causality.

---

# 15. Ownership, rename and succession are different events

## Rename
- same ownership;
- same assets;
- same clients;
- display name changes.

## Ownership/acquisition
- same operating company may remain;
- strategy/network/capital can change;
- local staff/assets/clients persist.

## Leadership succession
- company persists;
- strategy may change;
- no automatic asset transfer because nothing changed legal owner.

## Closure
- voluntary;
- insolvency;
- pivot out of market;
- acquisition/merger.

Suggested:
\`\`\`ts
type CompanyEvent =
  | RenameEvent
  | OwnershipEvent
  | LeadershipEvent
  | BusinessPivotEvent
  | ClosureEvent;
\`\`\`

Historical events are deterministic content; emergent events remain stochastic simulation.

---

# 16. Historical acquisition path must differ from random mergers

Add:
\`\`\`ts
applyHistoricalCompanyEvent(state, event)
\`\`\`

For PRG/EML:
- retain runtime \`RivalOps\`;
- retain city/base;
- retain receivables;
- retain booked jobs;
- retain local market share;
- update owner/network/name/strategy;
- possibly unlock international subhire access/capital.

Current \`rivalMergers\` should remain for alternate-history emergent consolidation, but historical events take precedence for surviving historical actors.

---

# 17. Client/promoter architecture

Today gigs are mostly generated without persistent promoter identity.

Add optional:
\`\`\`ts
interface Gig {
  // ...
  clientId?: string;
}
\`\`\`

Static client/promoter content:
\`\`\`ts
interface PromoterTemplate {
  id: string;
  nameEras: NameEra[];
  country: CountryCode;
  homeRegion?: MarketRegionId;
  active: HistoricalRange[];
  ownershipEvents?: OwnershipEvent[];
  marketSegments: ClientSegment[];
}
\`\`\`

Runtime relationship:
\`\`\`ts
clientRelations: Record<string, {
  trust: number;
  shows: number;
  spend: number;
  lastDay: number;
}>
\`\`\`

Effects:
- repeat supplier calls;
- negotiated terms;
- late-payment history;
- preferred regional suppliers;
- international tour access.

This makes Gay Mercader, Doctor Music, Tratos, The Project and Last Tour economically meaningful without making them rival rental firms.

---

# 18. Technical people architecture

Do not add every historical name as a full simulated crew member in Phase 1.

First step:
- content record;
- active tenure;
- UI/news;
- optional capability modifier.

Later:
- transferable notable technical figures;
- poaching/hiring;
- expertise graph;
- spin-offs.

\`\`\`ts
interface TechnicalFigureEffect {
  actorId: string;
  from: number;
  to?: number;
  effects: {
    brandExpertise?: string[];
    systemDesign?: number;
    training?: number;
    riderConfidence?: number;
  };
}
\`\`\`

Keep those numbers explicitly simulation-authored.

---

# 19. Startups and alternate history

Historical data must not turn the sim into a scripted museum.

Keep fictional startups.

But startup generation should:
- select business line(s);
- spawn from local market demand;
- possibly derive founder experience from an existing company;
- start small;
- use local supplier access.

A future spin-off event can use:
\`\`\`ts
founderOriginActorId?: string
\`\`\`

The Espiral/Altair/AEQ ecosystem and Musicson→Equipson lineage justify this.

---

# 20. Rival growth should choose among strategic options

Replace automatic "more of everything" with choices:

- deepen current specialization;
- add adjacent business line;
- open a regional depot;
- form a partner relationship;
- buy a new system;
- hire technical leader;
- improve workshop;
- pivot toward installation/distribution;
- remain deliberately regional.

Decision weights come from \`RivalStrategy\`.

This gives meaningful company identities without hard scripting each month.

---

# 21. Takeover valuation must eventually become asset-based

Current:
\`\`\`ts
40000 + reputation * 3000 + tier * 25000
\`\`\`

Future:
- cash/debt;
- actual gear;
- vehicles;
- receivables;
- contracts;
- client goodwill;
- supplier partnerships;
- premises;
- brand/reputation.

This can follow after specialization. It need not block Phase 1.

---

# 22. Save and migration strategy

Current save version is v7 and migration is additive.

Recommended:
- make all new historical/runtime fields optional;
- derive defaults for existing saves;
- bump save version only if invariant assumptions materially change;
- avoid saving static source/history data.

New optional state:
\`\`\`ts
marketRoster?: string[];
actorRelations?: Record<string, ActorRelationState>;
clientRelations?: Record<string, ClientRelationState>;
companyEventsApplied?: string[];
\`\`\`

Existing \`Rival\` can gain optional \`actorId\`, \`lineageId\`, \`strategyId\`.

Migration can map current known rival IDs directly to historical actor IDs.

---

# 23. Determinism requirements

Historical selection and event processing must be deterministic.

Rules:
- roster selection seeded from \`mapSeed\`;
- no use of wall clock;
- scheduled historical events keyed by ID;
- event applied once using \`companyEventsApplied\`;
- strategy-era resolution is pure from year + actor unless runtime divergence explicitly overrides it.

Balance reports must print:
- active actor roster;
- business lines;
- historical events applied;
- acquisitions/closures;
- partner networks.

Otherwise historical tuning will become impossible to debug.

---

# 24. Testing architecture

## Unit tests

### Presence
- \`'*'\` no longer implies local base.
- EML Spain local presence from 2006.
- PRG ownership event 2011 and rename 2012 preserve runtime operations.
- visiting foreign supplier creates no depot.

### Capabilities
- lighting-only actor cannot self-supply audio.
- audio firm can assemble job through preferred lighting partner.
- partner unavailability can force market subhire or decline.

### Region
- local crowding only counts eligible/reachable actors.
- island actors have local logistics advantage.

### Acquisition
- booked jobs survive.
- receivables survive.
- actual inventory survives.
- city market share survives.
- display name/network changes.

### Save
- roster selection persists across save/load.
- content list changes do not mutate existing roster.
- old v7 save migrates with deterministic actor IDs.

## Snapshot market tests

Spain:
- 1980
- 1985
- 1990
- 1995
- 2000
- 2006
- 2011
- 2015
- 2020

Snapshot:
- active local actors;
- visiting-only globals;
- role/business lines;
- region;
- leaders;
- owner/network;
- scale.

## Long balance tests

Compare:
- current generic rival model;
- historical chronology only;
- chronology + specialization;
- + partner network;
- + promoter relationships.

This isolates which architecture actually changes gameplay.

---

# 25. Incremental implementation sequence

## PR A — chronology/presence only
Minimal behaviour change:
- add historical actor identity;
- add local-presence eras;
- remove \`'*'\` => local depot;
- fix verified Spanish dates;
- EML Spain 2006 / PRG 2011 / rename 2012;
- snapshot tests.

## PR B — specialization
- business lines;
- sparse \`RivalOps\`;
- capability-gated bids;
- historical actor pools.

## PR C — partner/subhire network
- supply plan;
- preferred partners;
- generic local subhire;
- relationship learning.

## PR D — strategy eras and growth
- era-specific strategies;
- reinvestment decisions;
- pivots;
- regional vs national growth.

## PR E — ownership/succession
- historical company events;
- preserve assets/clients;
- management/news/UI.

## PR F — promoter/client graph
- persistent client IDs;
- repeat supplier relationships;
- promoter ownership transitions;
- regional/festival demand.

## PR G — supplier/technology graph
- market access;
- local support;
- brand relationships;
- documented fleet events.

This ordering keeps each PR measurable and avoids trying to replace the entire economic simulation at once.

---

# 26. What should *not* be done

- Do not encode every company found in a directory as an active rival.
- Do not make every named historical person a gameplay stat bundle.
- Do not hard-script historical winners irrespective of player-caused alternate history.
- Do not make a brand unavailable merely because no source has yet documented its distributor.
- Do not make acquisitions delete the acquired company's operating memory.
- Do not replace the current sim with a giant event script.
- Do not let historical content leak thousands of source strings into save files.
- Do not create one monolithic \`historicalMarket.ts\`.

---

# 27. Immediate code smells exposed by this research

These are not all in scope for PR #24, but they should shape follow-up work.

1. \`specialty\` currently barely constrains anything.
2. \`opsOf\` gives every rival all departments.
3. \`rivalReach\` derives international capability from \`countries:['*']\`.
4. \`rivalMergers\` treats every acquisition as base closure and identity destruction.
5. \`absorbRival\` fabricates generic acquired assets.
6. \`rivalStartups\` creates generic multi-department firms through \`opsOf\`.
7. global rival count controls crowding instead of local eligible competition.
8. product procurement ignores national supplier networks.
9. normal-gig ownership has no explicit subcontract plan.
10. historical company scale is not era-specific.

All ten are direct consequences of assumptions contradicted by the Spain research.

---

# 28. Architectural north star

The desired model is:

**historical content defines who could plausibly exist, where, in what business, under which ownership and with what documented relationships.**

**the simulation decides whether they thrive, fail, expand, partner, get bought, pivot or disappear.**

That boundary gives the game historical texture without sacrificing alternate history.

A Spanish 1990 run should feel structurally Spanish even if Sorter later goes bust, Fluge never becomes dominant, the player acquires Pronorte, or a fictional Galician staging company becomes unexpectedly important.

That is the point of the architecture: history constrains the initial conditions and opportunity graph; simulation owns the outcome.


---

# 29. Implementation status

Implemented on this branch (see docs/transport-tycoon-redesign.md, *Historic rivals*):

- **PR A, chronology and presence.** Actor registry (`src/world/content/actors/`) with presence, name and operating eras and company events. `'*'` is gone. Snapshot tests for Spain at 1980, 1985–95, 2006–12 and 2015–20 are in `src/world/__tests__/historicalMarket.test.ts`.
- **PR B, specialisation.** Business lines and sparse `RivalOps`. Bids are gated on capability before any roll. Historical regional actor pools are drawn by map seed and the draw is saved (`state.marketRoster`).
- **PR C, a light version.** Supply plans (`src/world/supply.ts`): owned kit, then a trusted partner, then the market. Partners are paid and their kit is held. Trust grows with repeated work and lowers the coordination penalty. Internalising a department is a yearly, strategy-weighted decision.
- **PR D, a light version.** Strategy eras per company (`src/world/strategies.ts`), each carrying its documented basis, kept separate from the people registry (`content/people.ts`).
- **PR E, a light version.** Ownership, absorbed, pivot and closure events applied once, with continuity (`src/world/companyEvents.ts`, `absorbInto`). Simulated mergers keep assets too.
- **Local eligible-market crowding** replaces `5 / rivals.length`.
- **Tests and bench.** `npm run balance:history` reports chronology only, then + specialisation, + partners and + local competition.

Not done yet:
- visiting-tour suppliers attached to specific international tours (§5.2);
- the promoter/client graph (§17);
- the supplier/technology graph (§13–14);
- asset-based takeover valuation (§21);
- talent migration and spin-offs (§18–19);
- region tags for countries other than Spain.
