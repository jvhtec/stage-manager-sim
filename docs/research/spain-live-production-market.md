# Spain: historical live-production market and rival-manager research (v0.2)

**Status:** research-first design proposal, not gameplay code yet.  
**Scope:** Spanish live technical production, PA/rental, adjacent AV/integration, suppliers, client ecology and multinational entry, approximately 1970–2026.  
**Repository impact reviewed:** `src/world/content/companies.ts`, `src/world/sim.ts` (`updateRivals`), `src/world/rivalOps.ts`, `src/world/market.ts`, `src/world/types.ts`.

This revision deliberately goes beyond foundation dates. The important historical facts for the simulation are **what a firm actually did in each era, where it worked, who led or technically shaped it, which manufacturers/importers it was tied to, which clients it served, and when its business model changed**.

## Research rules and confidence

- **A — primary / near-primary:** company history, official press release, BOE/BORME, manufacturer project case study, contemporary directory.
- **B — specialist trade source / contemporary professional interview:** strong enough for gameplay chronology, but preserve caveats.
- **C — career history / secondary directory / recollection:** useful corroboration, not enough by itself to create a precise founding date or acquisition.
- **D — industry folklore:** do not encode as fact until corroborated.

A company may have several historical dates:
`founded`, `liveRentalEntry`, `nationalTouringEntry`, `localPresence`, `integratedAVEntry`, `ownershipChange`, `exit`.
The current single `enters` date loses most of this history.

---

# 1. The structural correction: what "foreign competition" means in Spain

There are at least four different phenomena which the game currently collapses into one.

### A. A foreign tour brings its own supplier

Clair, Britannia Row, Showco, PRG predecessors and other international suppliers can enter Spain **with a specific international act** without maintaining a Spanish warehouse, Spanish sales force or local municipal/festival market share. The visiting supplier should be attached to that tour/job, not spawned as a permanent Spanish rival.

### B. A foreign company buys equity in a Spanish AV firm

Italian Euphon acquired a **60% stake in Barcelona-based Sono Multivisión around 2000/01**. Cinco Días reported the transaction in February 2001 and identified Gaspar Bestard as Sono's director general.

Source: https://cincodias.elpais.com/cincodias/2001/02/08/empresas/981643212_850215.html

This matters historically, but Sono is broader corporate/institutional AV and systems work. It is not evidence that a foreign arena-PA giant suddenly operated a Spanish national touring fleet in 2001.

### C. A multinational production group acquires a local Spanish technical operation

**PRG announced the acquisition of First Events/EML operations, including Spanish Sound and Light Productions S.L., on 5 January 2011.** The Spanish company later appears under the Production Resource Group name in 2012.

Sources:
- https://www.prnewswire.com/news-releases/production-resource-group-acquires-eml-productions-in-europe-112936894.html
- https://www.empresia.es/empresa/production-resource-group/

By 2016 PRG Spain was documented supplying audiovisual, lighting, video and sound for the main stages of the first Mad Cool.

Source: https://www.digitalavmagazine.com/en/2016/08/31/mad-cool-festival-madrid-conto-con-la-produccion-av-y-de-iluminacion-de-prg-spain/

**Gameplay interpretation:** 2011 is currently the strongest evidence for a major multinational technical-production group gaining a durable local Spanish operating platform by acquisition.

### D. Later international groups build/acquire Spanish operations

Creative Technology now has Barcelona and Madrid teams and Spanish management, but the Spanish corporate investment structure visible in the register is much later (2021 onward). This belongs in the later-era research, not as a 1990s rival.

Sources:
- https://ct-group.com/es/contact/
- https://www.empresia.es/empresa/creative-technology-investment/

**Immediate bug:** `rivalsFor(country)` admits every `countries:['*']` company according to its *global* founding year. `updateRivals` then gives that company a permanent Spanish warehouse. A 1980/1990 Spanish game can therefore contain locally based Clair and LSD/PRG decades before documented local entry.

---

# 2. The domestic Spanish market was dense, regional and technically interconnected

The strongest evidence so far supports a very different picture from a handful of generic national rivals. Spain developed a network of **Madrid, Barcelona/Catalonia, Asturias, Andalucía, Castilla y León and Basque-region suppliers**, plus manufacturers and distributors that often shared personnel.

A 2019 Spanish trade retrospective explicitly names **Berenice, Milán Acústica, Sorter, Espiral, Twin Cam and Apogee** among the important firms that grew with the 1970s–90s live market. It also describes three distinct customer bases: large touring/concert suppliers, public-sector/municipal suppliers, and smaller verbena/regional firms.

Source: https://instalia.eu/empresas-de-alquiler-de-equipos-de-sonido/

That segmentation is more useful for gameplay than a simple tier number.

---

# 3. Company-by-company research roster

## 3.1 Milán Acústica — Madrid

**Evidence**
- Milán states it began in **1976** to provide sound reinforcement for events.
- It developed a substantial electronics repair laboratory.
- In **2000** it created Milán Miscelánea as demand for fixed installations, sales and planning grew.
- A period trade source documents Milán Acústica supplying the **Vodafone FIB Club** with Meyer Sound and Soundcraft Vi6 equipment.
- Teatro Real's 1997–2007 institutional records list Milán Acústica among suppliers.

Sources:
- https://www.milanmiscelanea.com/empresa
- https://www.milanacustica.com/
- https://www.ispmusica.com/?lang=es&start=1716
- https://www.teatroreal.es/sites/default/files/2019-03/Memoria%201997-2007_0.pdf

**Current game error:** enters 1981.  
**Proposed:** `founded/liveRentalEntry: 1976`.

**Historically grounded strategy**
- early: audio hire + maintenance depth;
- later: installation/service diversification;
- maintain workshop quality more aggressively than a pure gig-chasing firm;
- not necessarily the fastest geographic expansion.

**Manager:** no sufficiently sourced founder/MD name yet. Keep "Milán founding team" until verified.

---

## 3.2 Espiral — Madrid

**Evidence**
- Founded **1977** by a group from Madrid's ETS de Ingenieros de Telecomunicación.
- Initially manufactured Hi-Fi amplifiers and loudspeakers.
- Entered professional audio hire / sound reinforcement in the **early 1980s**.
- 1980s tours: **Radio Futura, Hombres G, Siniestro Total**.
- Madrid venues: **Universal, Astoria, Revolver, Aqualung**.
- 1990s tours: **Rocío Jurado, Mónica Naranjo, Ricky Martin, Joaquín Cortés**.
- Festivals: **Festimad, Benicàssim, Coruña Pop Rock, Espárrago**.
- Also worked **PSOE and PP electoral tours**, private television and corporate work.
- From around 2000 it concentrated more strongly on Madrid, including **La Riviera, Joy Eslava, Caracol, La Casa Encendida, Círculo de Bellas Artes and INAEM** work.

Source: https://www.espiral.es/historia/

**The much more interesting lineage:** Espiral's engineering group became a seedbed for Spanish audio manufacturing/importing. Its own history and Altair's history describe founders/partners branching into companies including **Altair / Equipos Europeos Electrónicos, AEQ, SPA, Wavenet and Dosveinte**, while maintaining professional ties.

Sources:
- https://www.espiral.es/historia/
- https://altair.altairaudio.com/index.php?Itemid=113&id=155&lang=es&option=com_content&view=article
- https://apasl.es/sobre-nosotros/

**Named historical figure**
- **Gerardo Meiro**: identified by Altair as one of four young telecom engineers who created Espiral in 1977 and as a leading figure in that founding group; later moved into computing/software before rejoining the Altair project.

**Gameplay**
- early engineering/manufacturing advantage;
- cheaper/earlier access to domestic electronics and repair capability;
- spin-off network creates supplier relationships rather than merely cash bonuses;
- high probability of technical staff leaving to found related businesses;
- business gradually shifts from national touring towards institutional/local Madrid work.

This is exactly the kind of company that should **change strategy with era**, rather than have one immutable AI personality for fifty years.

---

## 3.3 LIL Service → Twin Cam Audio — Barcelona

**Evidence**
- Specialist retrospective dates origin to **1979 as LIL Service**.
- Described as Spain's first Meyer Sound importer.
- Later fleet documented as L-Acoustics.
- 2017 source names **Pablo Jiménez ("Pablito")** as the source's Twin Cam audio contact.
- It credits Twin Cam with tours for **La Oreja de Van Gogh, Amaral, Bunbury** and repeated **Sónar** work.
- In 2018 Twin Cam supplied four DiGiCo consoles for Operación Triunfo: SD5, SD10 and broadcast SD5/SD7 positions.
- A 1994 international directory identifies **Rafael Campos as managing director of Twin Cam Audio Performance**.
- James Woods' career biography says he was **Technical Director at Twin Cam Audio** before founding Woods Engineering in 1999.

Sources:
- https://instalia.eu/conciertos-pesos-pesados-sonorizacion/
- https://meyersound.es/noticias/directo/digico-el-control-perfecto-para-las-galas-en-directo-de-operacion-triunfo/
- 1994 directory via World Radio History
- https://www.prosoundweb.com/rational-acoustics-appoints-woods-engineering-as-official-smaart-instructors/

**Important caveat:** the game's **1990 rename from LIL Service to Twin Cam is still not independently verified**. Treat the lineage as likely, the exact rebranding year as unresolved.

**Named people / succession candidates**
- **Rafael Campos** — managing director documented in 1994.
- **James Woods** — technical director in the pre-1999 period, not necessarily corporate head.
- **Pablo Jiménez** — audio department/source contact documented in 2017.

**Gameplay**
- premium touring PA and rider compliance;
- unusually strong relationship with imported high-end brands;
- technical-director era can affect systems engineering and training;
- Barcelona/Catalonia and major festival strength;
- no reason to model the 1979 firm as already having its 2010s national scale.

---

## 3.4 Berenice Concert Systems — Madrid

**Evidence**
- Trade retrospectives identify Berenice as one of the important early Spanish concert-sound companies.
- James Woods' professional biography records employment as an **audio engineer at Berenice Concert Systems in Madrid**, before Meyer/CYP and Twin Cam.
- Another career record places a technician at Berenice **1988–1995**, giving a solid operational window.
- Berenice Concert Systems S.A. appears in official Spanish records; a 2017 BOE publication includes its NIF in a tax-registration revocation list. This proves legal identity and a late administrative event, **not** the date when concert operations ceased.

Sources:
- https://instalia.eu/empresas-de-alquiler-de-equipos-de-sonido/
- https://www.prosoundweb.com/rational-acoustics-appoints-woods-engineering-as-official-smaart-instructors/
- https://www.boe.es/buscar/doc.php?id=BOE-A-2017-11306

**Current game:** arbitrary 1982 entry.  
**Research state:** definitely a meaningful 1980s–90s rival; exact founding year still unresolved.

**Gameplay**
- strong Madrid concert specialist;
- should participate in technician mobility;
- do **not** invent a named owner/manager yet.

---

## 3.5 Sorter — Madrid

**Evidence**
- A 2017 specialist profile says Sorter was created by **a group of musicians in the 1980s**.
- It initially used **self-built systems**.
- Later it invested heavily in **EAW**, then moved to **L-Acoustics**.
- **José Antonio Caballero** is identified as responsible for event production/concert setup in that 2017 article.
- The source associates Sorter with **Joaquín Sabina**, and names sound engineer **Juan González** and Sorter colleague **Roque** in that context.

Source: https://instalia.eu/conciertos-pesos-pesados-sonorizacion/

**Current game:** hard-coded 1984 entry.  
**Proposed:** keep an approximate "early/mid 1980s" start until a legal or contemporary source provides a precise year.

**Gameplay**
- musician-founded, vertically technical;
- early homemade-gear/repair competence;
- later EAW investment, then L-Acoustics ecosystem;
- repeat-artist relationships should be particularly important;
- José Antonio Caballero can appear as a later-era production leader, **not retroactively as the founder**.

---

## 3.6 Pronorte — Gijón

**Evidence**
- Company says founded **1985 in Gijón**.
- Founder/manager: **José Javier García "Boby"**.
- Current staff page identifies Boby as heavily dedicated to sound/live events.
- Pronorte says its sound/lighting division worked with artists ranging from **Pavarotti to Guns N' Roses, Bob Dylan and Deep Purple**.
- A 2007 Mix case study says Pronorte supplied EAW KF730 for **Les Luthiers in Madrid** and that this was the **fifth consecutive time** Pronorte had supported Les Luthiers in Spain.
- That article quotes José Javier García directly about system choice.
- Company also emphasizes workshop/repair and instrument-retail expertise.

Sources:
- https://www.pronorte.es/info/quienes-somos
- https://www.mixonline.com/news/les-luthiers-performs-eaw-help-422377

**Current game errors:** enters 1992, HQ Oviedo.  
**Fix:** **1985, Gijón**.

**Named manager**
- **José Javier García "Boby"**, founder and manager.

**Gameplay**
- regional/national hybrid;
- strong technical support/workshop;
- repeat-client loyalty;
- conservative geographic expansion;
- personnel retention and technical continuity should matter more than maximum fleet growth.

---

## 3.7 Fluge — Madrid region

**Evidence**
- Company history: founded **1990**, initially focused primarily on **live sound**.
- Soon expanded into **professional lighting and video**, then installations, venues, virtual/hybrid events and R&D.
- Later developed multiple Spanish and international branches.
- 2017 trade feature associates Fluge with tours for **Alejandro Sanz, Malú, Pablo Alborán, Miguel Bosé**, and cites **Luz Casal** as a memorable production.
- That source describes early Meyer Sound use and later D&B, Adamson, DAS etc.
- Founder/president publicly identified as **Luis Berlanga**.

Sources:
- https://fluge.es/nuestra-historia/
- https://instalia.eu/conciertos-pesados-sonorizacion/ (if URL redirects, use https://instalia.eu/conciertos-pesos-pesados-sonorizacion/)
- https://allmusicspain.com/entrevistas/entrevista-a-luis-berlanga-fundador-y-principal-responsable-de-fluge-audiovisuales/

**Current game:** 1991.  
**Fix:** **1990**.

**Named manager**
- **Luis Berlanga**, founder/president.

**Gameplay**
- 1990: small/medium sound-tour company;
- 1990s/2000s: aggressive **department diversification**;
- later: integrated package supplier, offices, venue management and internationalization;
- advantage comes from complementary departments and scale, not a magical high reputation on day one.

This is a perfect case for **scaleByEra**.

---

## 3.8 Soinua — Arrasate / Basque Country

**Evidence**
- Soinua states its origins are in **1990**.
- It says that until **2015** it performed events, sound reinforcement, tours and concerts.
- Around **2014** it began a new professional-audio distribution path and subsequently focused on premium-brand distribution, while retaining rental capability.

Source: https://soinua.com/sobre-nosotros/

**Gameplay**
- add as a northern Spanish live-rental rival from 1990;
- around 2014/15 its strategy pivots from gig competition toward **distribution/supplier network**;
- rather than simply "exit", it can become a supplier whose relationships affect product availability and subhire.

This is historically richer than killing the company at an arbitrary exit date.

---

## 3.9 Prosoda → RCA Pro — Consuegra / Toledo

**Evidence**
- RCA Pro's published company history says the professional lineage starts with **Prosoda S.L. in 1990 in Consuegra (Toledo)**.
- Early work included electronics repair, installations, leisure venues and loudspeaker enclosure design.
- Prosoda split in 2003; the later RCA structure was created in 2005.

Sources:
- https://www.lafactoriadelshow.com/rca-pro/
- https://www.lafactoriadelshow.com/alquiler-equipos-sonido/conciertos/

**Gameplay**
- regional technical/repair firm which can grow into broader AV;
- strong electronics/installation competence;
- useful representative of a market tier the current rival roster largely omits.

---

## 3.10 Apogee Servicios — Sevilla

**Evidence**
- Spanish company-register sources record **Apogee Servicios S.L. constituted in 1993** in the Sevilla area.
- Its corporate object explicitly included purchase, sale, **rental, repair, distribution and installation of sound, lighting and video equipment**.
- A technical career record places a responsible sound technician at **Apogee Telecomunicaciones in 1999–2000**, with projects involving **Ismael Serrano and Víctor Manuel**.

Sources:
- https://www.axesor.es/Informes-Empresas/626426/APOGEE_SERVICIOS_SL.html
- https://alitlelessgraviti.blogspot.com/2012/04/

**Current game:** 1985.  
**Correction:** the **documented legal entity is 1993**. There may have been an earlier predecessor, but none is verified yet.

**Gameplay**
- Andalucía regional audio/light/video firm;
- 1990s integrated technical services;
- do not backdate to 1985 without evidence.

---

## 3.11 Sonorock — Sevilla

**Evidence**
- A detailed technician career history records work at **Sonorock from 1992 to 1994** as sound technician / technical lead.
- Named artists in that period include **No Me Pises Que Llevo Chanclas, Duncan Dhu, Los Ronaldos, La Frontera, Manolo Sanlúcar, Danza Invisible, Alaska y Dinarama** and others.
- Directory traces confirm a Sonorock S.L. sound-reinforcement business in Sevilla.

Sources:
- https://alitlelessgraviti.blogspot.com/2012/04/
- https://www.paginasamarillas.es/f/sevilla/sonorock-s-l-_151751633_000000001.html

**Gameplay**
- credible early-1990s Andalucía rival;
- precise foundation/exit dates still need primary-source work.

---

## 3.12 TCM Audiovisión — Sevilla

**Evidence**
- Career source has a technician as TCM responsible sound technician **1994–1996** and later technical production head **2007–2010**.
- Industry directory describes TCM as an Andalucía AV cluster with **sound, lighting, projection and video**, operating nationally and internationally for more than 25 years.

Sources:
- https://alitlelessgraviti.blogspot.com/2012/04/
- https://eventplannerspain.com/es/company/tcm-audiovision

**Gameplay**
- integrated Andalucía supplier demonstrably active by 1994;
- more corporate/TV/event integration than a pure PA house;
- candidate for a "multi-service regional incumbent" strategy.

---

## 3.13 Daniel Sonido — Sevilla

**Evidence**
- A 1991 trade/publication directory lists **Daniel Sonido S.L., Sevilla**.
- Later career source records technical consultancy for Daniel Sonido.

Sources:
- https://scherzo.es/wp-content/uploads/2020/06/Scherzo_053-Abril91.pdf
- https://alitlelessgraviti.blogspot.com/2012/04/

**Gameplay status:** documented existence by 1991, insufficient evidence yet for exact foundation, scale or national touring role. Add to research backlog rather than inventing stats.

---

## 3.14 Use Sonido — Valladolid

**Evidence**
- Company says it was founded by **Eusebio Marchena and Carmen Herrero** more than 30 years ago.
- It describes itself as a family company serving festivals, tours, concerts, theatre and events.
- A 2014 Meyer Sound case study describes Valladolid-based Use Sonido as a full-service sound/lighting provider serving touring, corporate, theatre and festival markets nationally; its Meyer LYON system was used after a Sergio Dalma tour for a Manuel Carrasco tour.

Sources:
- https://www.usesonido.com/quienes-somos/
- https://meyersound.com/news/use-sonido/

**Named managers/founders**
- **Eusebio Marchena**
- **Carmen Herrero**

**Gameplay**
- Castilla y León regional base with national touring;
- family/continuity model;
- premium Meyer investment in later years;
- exact foundation year still needs a dated primary source, so store a range rather than pretending certainty.

---

## 3.15 Sono — Barcelona / Catalonia

**Evidence**
- Sono dates its origin to **1972** and describes itself as a pioneer in the Spanish AV sector.
- A 2024 interview says many professionals trained at Sono later created other sector companies.
- Italian Euphon acquired a **60% stake around 2000/01**.
- **Gaspar Bestard** was identified as director general at the time.

Sources:
- https://avintegracion.com/sono-medio-siglo-innovando-desde-la-encrucijada-entre-tecnologia-y-tradicion/
- https://www.sono.es/
- https://cincodias.elpais.com/cincodias/2001/02/08/empresas/981643212_850215.html

**Gameplay**
- do not treat as identical to a rock-tour PA house;
- important corporate/institutional AV and technical-talent nursery;
- foreign-equity event circa 2000 without pretending this equals PRG-style national concert-rental dominance.

---

## 3.16 PRG Spain / EML lineage

**Evidence**
- PRG announced acquisition of a European group including Spanish **Sound and Light Productions S.L.** in January 2011.
- Spanish registration history shows subsequent PRG naming.
- By 2016 PRG Spain was providing full AV/lighting/video/sound production for major Mad Cool stages.

Sources:
- https://www.prnewswire.com/news-releases/production-resource-group-acquires-eml-productions-in-europe-112936894.html
- https://www.empresia.es/empresa/production-resource-group/
- https://www.digitalavmagazine.com/en/2016/08/31/mad-cool-festival-madrid-conto-con-la-produccion-av-y-de-iluminacion-de-prg-spain/

**Gameplay**
- enter via **acquisition**, inheriting predecessor assets, staff, clients and reputation;
- don't spawn a pristine multinational from empty land;
- represents the transition to genuine locally embedded multinational production competition.

---

# 4. Named historical people and why they matter to gameplay

Real people should have **documented roles and actions**, while numerical AI traits remain explicitly fictional design interpretations.

| Person | Documented role | Era | Safe gameplay interpretation |
|---|---|---:|---|
| **Gerardo Meiro** | One of four young telecom engineers behind Espiral's 1977 origin; later associated with Altair | 1977–early 1980s+ | engineering/manufacturing founder era; strong repair/R&D network, spin-off chance |
| **Rafael Campos** | Managing Director, Twin Cam Audio Performance in 1994 directory | 1994 | high-end PA / technical-capital era; identity verified, personality not inferred |
| **James Woods** | Berenice engineer → CYP Meyer specialist → Twin Cam Technical Director → Woods Engineering founder 1999 | 1980s–2000s | model *technical talent migration* and systems-engineering knowledge transfer |
| **Pablo Jiménez ("Pablito")** | Twin Cam audio representative/contact in 2017 profile | 2010s | later premium touring/rider-compliance technical leadership |
| **José Javier García "Boby"** | Pronorte founder/manager, dedicated to live sound/events | 1985 onward | regional relationship + workshop + repeat-client strategy |
| **Mabel Rodríguez** | Pronorte administration, >35 years experience according to company | long-term | evidence that admin continuity can be a real firm capability; useful for office/receivables, not a "personality stat" |
| **Luis Berlanga** | Fluge founder/president | 1990 onward | integrated-department expansion and diversification |
| **José Antonio Caballero** | Sorter event-production/concert setup responsible in 2017 source | 2010s | production-led scheduling/artist-relationship policy |
| **Eusebio Marchena** | Use Sonido founder | 1990s? onward | family-company technical continuity |
| **Carmen Herrero** | Use Sonido founder | 1990s? onward | family-company commercial/operational continuity |
| **Gaspar Bestard** | Sono director general during 2001 Euphon transaction | 2001 | corporate AV integration / ownership-transition era |
| **Jere Harris** | PRG chairman/CEO at 2011 acquisition announcement | 2011 | corporate acquisition event only; do not present as resident Spanish operating manager |

### The particularly valuable historical mechanic: technical people move between ecosystems

James Woods gives us a documented example:
**Berenice → CYP/Meyer → Twin Cam technical director → independent systems engineering/training company.**

That means the sim could support **notable technical personnel** separate from corporate managers:
- staff can improve system design / brand expertise / training;
- leaving a rival does not merely subtract "skill";
- they can carry vendor knowledge and relationships into another firm;
- new companies can emerge from the industry's existing talent pool.

Espiral's founder/partner ecosystem provides the same pattern at company scale:
**rental/manufacturing collective → Altair / AEQ / SPA / Wavenet / Dosveinte and related businesses.**

This is far closer to how a small technical industry actually develops than random rival stat growth.

---

# 5. Technology and supplier ecosystem: a missing layer in the simulation

A Spanish PA company in 1985 did not choose from a timeless global catalogue with equal availability.

The 2019 retrospective describes:
- domestic manufacturers including **Beyma, Musicson and DAS Audio**;
- import/distribution firms such as **Ear Pro, Auprosa, Lexon and Smart Systems**;
- large rental houses investing in imported rider-friendly equipment such as **Meyer MSL-3 / UPA, EAW KF850, JBL and Martin Audio**;
- smaller and municipal suppliers using more domestic/intermediate gear;
- increasingly demanding technical riders forcing capital investment.

Source: https://instalia.eu/empresas-de-alquiler-de-equipos-de-sonido/

### Espiral-derived manufacturers

Altair's own history says four young telecom engineers founded Espiral in 1977, originally making amplifiers; subsequent specialization produced or helped seed several Spanish audio firms.

Source: https://altair.altairaudio.com/index.php?Itemid=113&id=155&lang=es&option=com_content&view=article

**Gameplay consequences**
- `vendorAvailability(country, year)`, not only product intro year;
- distributor relationships affect purchase lead time, financing, demo stock and support;
- domestic brands can be cheaper/easier to service;
- premium imported brands can satisfy riders and international engineers;
- a company that was an importer/distributor may have a historically justified product advantage;
- product transitions should affect firms differently rather than all rivals upgrading simultaneously.

### Examples already documented

- **Twin Cam:** Meyer importer → later L-Acoustics fleet.
- **Sorter:** self-built → EAW → L-Acoustics.
- **Pronorte:** EAW, including repeated Les Luthiers work.
- **Fluge:** early Meyer; later multiple major systems including D&B, Adamson, DAS.
- **Milán:** Meyer documented in FIB-era work.
- **Use Sonido:** Meyer LYON documented 2014.

This is enough to seed era-specific inventory preferences without inventing exact box counts.

---

# 6. The actual Spanish demand channels

The game should stop treating "a gig" as one market.

The historical sources describe at least these separate demand channels:

### Touring artists
High rider pressure, repeat supplier relationships, national routing, investment-heavy.

### Municipal/public work
Ayuntamientos, theatres, schools, diputaciones, sporting events, political rallies. Trade retrospective specifically notes that these clients could support stable regional firms but were painful on **payment timing**.

Source: https://instalia.eu/empresas-de-alquiler-de-equipos-de-sonido/

### Verbenas and orchestras
Extremely price-sensitive, major 1980s–90s market. Some orchestras bought their own increasingly capable PA, later reducing demand for mid-market rental firms.

### Concert halls / private rooms
Many venues progressively acquired house equipment, reducing some rental demand while creating installation/service demand.

### Festivals
Strongly expanded the requirement for large seasonal systems. Espiral documents Festimad, Benicàssim, Coruña Pop Rock and Espárrago; Twin Cam is repeatedly associated with Sónar.

### Electoral/political tours
Espiral documents work for PSOE and PP tours. This should exist as a real seasonal/event type with very different routing and payment/client characteristics.

### Television and broadcast entertainment
Twin Cam's Operación Triunfo work, Espiral private-TV work, Sono, TCM and later integrated suppliers demonstrate that live audio and TV were overlapping markets.

### Corporate/institutional AV
Becomes increasingly important, especially for firms such as Sono, TCM, Fluge and later integrated providers.

---

# 7. Historical market eras for Spain

## 1975–1982: formation and engineering culture

Anchors:
- Milán 1976.
- Espiral 1977.
- LIL Service/Twin Cam lineage 1979.
- Early domestic manufacturers and improvised/self-built systems remain important.
- Large international touring acts may carry foreign suppliers, but the domestic daily market is not populated by permanent Clair/PRG warehouses.

**Model**
- low number of national-tier suppliers;
- high repair/manufacture value;
- limited imported high-end stock;
- regional reputations dominate;
- technician/founder entrepreneurship high.

## 1983–1991: national touring expansion

Anchors:
- Berenice, Sorter and other Madrid firms established in the decade.
- Pronorte 1985.
- Fluge and Soinua 1990.
- Prosoda 1990.
- Riders become more demanding, pushing investment in Meyer/EAW/JBL/Martin/Midas/Soundcraft-class equipment.
- Political rallies, municipal events and touring coexist.

**Model**
- rapid organic growth;
- strong artist-supplier relationships;
- companies specialize rather than all becoming integrated AV giants;
- payment risk differs by public/private client class.

## 1992: extraordinary project year

Barcelona Olympics and Expo Sevilla create unusually large project demand and a temporary skill/equipment mobilization.

The game already has Barcelona '92 and Expo '92 scenarios. These should also change the **ordinary market around them**:
- temporary cross-hire scarcity;
- freelancer wages;
- truck demand;
- national movement of equipment;
- post-event used-equipment supply / trained workforce.

Do not model it as a permanent national demand multiplier.

## 1993–1999: festival and private-TV expansion

Anchors:
- Apogee legal entity 1993.
- Sonorock active by 1992.
- TCM demonstrably active by 1994.
- Espiral documents Festimad, Benicàssim, Espárrago and private-TV work.
- Twin Cam grows major touring/festival identity.

**Model**
- festival stages become a separate seasonal tender market;
- companies with sufficient duplicated inventory gain advantage;
- private TV creates another path for console/RF/crew investment;
- regional firms can move nationally without requiring permanent new depots.

## 2000–2008: integrated AV and public-spending boom

Anchors:
- Milán Miscelánea formed 2000 for installations/sales.
- Sono foreign equity transaction 2000/01.
- Espiral shifts more work toward Madrid institutions/corporate.
- Festival and municipal event boom described by trade retrospective.
- Fluge expands beyond sound into integrated technical production.

**Model**
- lots of work, easier equipment amortization;
- public-sector contracts and free municipal concerts matter;
- firms diversify into installation, TV, corporate, lighting/video;
- line-array/digital-console transition creates expensive upgrade cycle.

## 2009–2013: financial crisis and market shakeout

APM historical series shows major contraction in Spanish live activity/revenue over this period; specialist retrospectives also describe severe pressure, especially on medium-size rental companies.

Use APM concert counts/revenue as **directional market evidence**, not literal rental revenue.

Source series:
https://interaccio.diba.cat/sites/interaccio.diba.cat/files/anuario-apm-2021-web.pdf

Trade retrospective:
https://instalia.eu/empresas-de-alquiler-de-equipos-de-sonido/

**Model**
- fewer municipal budgets;
- prices compressed;
- slower receivables / defaults;
- used equipment liquidation;
- mid-tier suppliers are most vulnerable;
- strongest local relationships and diversified installation/corporate firms survive better.

## 2011 onward: locally embedded multinational production groups

PRG's Spanish acquisition provides a concrete transition point.

**Model**
- multinational enters by acquiring an existing company and inherits local assets/relationships;
- domestic incumbents now compete against a group with cross-border inventory and capital;
- foreign groups should still face Spanish labour, logistics, client and payment conditions.

## 2012–2017: tax and austerity environment

Spain raised the live cultural VAT rate to 21% in 2012 and reduced live-show VAT to 10% in 2017.

Sources:
- https://www.rtve.es/noticias/20170330/gobierno-rebajara-este-viernes-iva-cultural-del-21-10-a-espectaculos-directo/1513623.shtml
- https://sede.agenciatributaria.gob.es/Sede/iva/novedades-iva/novedades-normativa/ley-3-2017-27-junio-junio__.html

**Important:** transmit this through promoter economics, ticket prices and demand. It is **not** a blanket 21% cost slapped on a technical rental quote.

## 2014–2019: consolidation and festival-scale production

Anchors:
- Soinua exits/reduces live-production emphasis around 2014/15 into distribution.
- PRG Spain handles major Mad Cool production by 2016.
- domestic large integrated firms continue growing.
- festival ecosystem becomes increasingly important.

## 2020–2021: shutdown and survival

Existing game market shutdown mechanics are directionally appropriate, but Spain should eventually get country-specific support/cancellation/reopening calibration.

## 2022 onward: capital intensity and consolidation

Video/LED/networking/automation/large-format production continue increasing capital requirements. Later multinational entrants and acquisitions should be researched separately rather than retroactively backfilled.

---

# 8. Promoters and clients matter because suppliers do not create demand themselves

A technical-rental history without promoters is only half a market.

### Gay Mercader / Gay & Company / Gamerco
Gay Mercader is documented as a central Spanish rock promoter from the 1970s. He promoted the Rolling Stones' first Spanish concert in Barcelona in 1976. Later Gamerco appears alongside major international tours.

Sources:
- https://www.thelogicalweb.com/mas-contenidos/the-logical-web/entrevistas-en-exclusiva/689-gay-mercader-en-the-logical-web-octubre-2009.html
- https://elpais.com/cultura/2026-06-10/un-rito-sexual-en-el-escenario-y-bombas-de-humo-en-la-grada-medio-siglo-del-primer-concierto-de-the-rolling-stones-en-espana.html

**Gameplay:** promoters should develop supplier relationships and negotiating habits separately from artists.

### Regional promoters
Later promoter ecosystems such as Last Tour and others create distinct regional/festival demand. Research this as a **client layer**, not rival rental companies.

### Municipalities
Public-sector buyers should be individual recurring clients with:
- budget cycles,
- political/event calendars,
- slower payment distributions,
- tendering,
- local incumbent preferences.

---

# 9. Proposed rival-manager architecture

Do not put `aggression: 0.8` on a real human and pretend history proved it.

Separate:

```ts
interface HistoricalLeader {
  id: string
  name: string
  companyId: string
  from?: number
  to?: number
  role: string
  evidence: SourceRef[]
}

interface RivalStrategy {
  id: string
  // explicitly game-model assumptions
  touringFocus: number
  municipalFocus: number
  corporateFocus: number
  regionalStickiness: number
  riderInvestment: number
  workshopInvestment: number
  departmentDiversification: number
  officeInvestment: number
  debtTolerance: number
  clientRetention: number
  supplierNetwork: number
}
```

Then attach **strategy eras**, not permanent human personality:
- `espiral-engineering-1977`
- `espiral-touring-1983`
- `espiral-madrid-institutional-2000`
- `fluge-live-audio-1990`
- `fluge-integrated-av-2000s`
- `soinua-live-production-1990`
- `soinua-distribution-2015`

A leadership record can be displayed in the UI and trigger news without being the direct numerical source of every company action.

---

# 10. Company lineages and people should persist through ownership changes

A PRG acquisition should not create a blank company.

Need:
```ts
interface RivalLineage {
  id: string
  founded?: number
  predecessorIds?: string[]
  ownershipEvents?: {
    year: number
    buyer: string
    displayName?: string
    news: string
  }[]
}
```

Assets that should normally survive acquisition:
- client relationships,
- office/warehouse location,
- technicians,
- vehicles,
- installed equipment,
- local market share,
- receivables/payables.

What may change:
- capital access,
- procurement network,
- strategy,
- displayed name,
- international subhire access.

---

# 11. Concrete corrections to the existing Spanish roster

| Current entry | Current data | Research correction |
|---|---|---|
| `milan` | enters 1981 | **1976** |
| `twincam` | 1979 + 1990 rename | 1979 lineage plausible; **rename year unresolved** |
| `berenice` | enters 1982 | keep 1980s approximate until exact source; active by at least 1988 |
| `sorter` | enters 1984 | **1980s**, exact year unresolved |
| `apogee` | enters 1985 | documented Apogee Servicios legal entity **1993**; research predecessor before deciding |
| `fluge` | enters 1991 | **1990** |
| `pronorte` | 1992, Oviedo | **1985, Gijón** |
| `tole` | 1995 | unverified |
| international `clair` | global 1966 → Spanish warehouse | **wrong model**; tour supplier ≠ permanent local rival |
| international `lsd/prg` | global 1979 → Spanish warehouse | **wrong model**; local PRG platform documented from **2011 acquisition** |
| international `solotech` | global 2005 → Spanish warehouse | no Spanish-local-entry evidence found; do not spawn by global founding |

### Strong candidates to add
- Espiral
- Soinua
- Prosoda/RCA lineage
- Use Sonido
- Sono (specialized AV category)
- Sonorock
- TCM Audiovisión
- PRG Spain / EML lineage

### Research backlog before inclusion as fully statted rivals
- Daniel Sonido
- exact Apogee predecessor
- exact Berenice founding/operating end
- Sonido Tole
- additional Valencia, Galicia, Basque, Canary and Balearic suppliers
- historic Spanish lighting-only, staging and video houses (current roster is audio-heavy)

---

# 12. Tests the historical model should pass

For deterministic seed and available warehouse space:

### ES 1980
- Milán and Espiral can exist.
- LIL/Twin Cam lineage may exist.
- no permanent Spanish Clair/PRG/Solotech warehouse.
- imported international touring supplier may appear **only attached to a visiting tour**.

### ES 1986
- Pronorte can exist in Gijón.
- Sorter/Berenice can exist if their final verified start date permits.
- Fluge cannot yet exist.

### ES 1990
- Fluge, Soinua, Prosoda can emerge **small**, not fully integrated tier-4 giants.
- Spain remains dominated by domestic/local firms.

### ES 1994
- Apogee/TCM/Sonorock evidence supports a denser Andalucía market.
- festival and TV/corporate channels growing.

### ES 2001
- Sono can receive foreign ownership without becoming generic PRG-style arena PA.
- local domestic rental market remains strong.

### ES 2010
- PRG must not yet have its post-acquisition Spanish company.
- recession pressure should already be biting.

### ES 2011/12
- EML/Spanish operation is acquired into PRG lineage;
- assets/relationships persist across name/ownership change.

### ES 2015
- Soinua strategy can pivot toward distribution rather than simply disappearing.
- major domestic integrated players coexist with multinational PRG.

### ES 2020
- no fictional instant bankruptcy purely because COVID starts;
- shutdown/support/cancellation mechanics apply.

---

# 13. Next research targets

1. **Exact legal/history dates:** Berenice, Sorter, Twin Cam brand transition, Apogee predecessor, Sonido Tole.
2. **Lighting:** identify Madrid/Barcelona/Andalucía lighting specialists and ownership histories instead of making sound houses cover every department.
3. **Video/LED:** trace Spanish event-video companies before integrated LED-era consolidation.
4. **Staging/rigging:** regional stage/roof suppliers need their own history and capital model.
5. **Promoter graph:** Gay Mercader/Gamerco, Doctor Music, Last Tour, festival promoters, municipal clients, TV production clients.
6. **Distributor graph:** Ear Pro, Auprosa, Lexon, CYP/Meyer, L-Acoustics distribution and Spanish manufacturers.
7. **Festival supplier credits:** year-by-year Festimad, FIB, Sónar, Espárrago, later Primavera/Mad Cool/BBK.
8. **Notable technician graph:** distinguish company leadership from FOH/system engineers and allow talent to move.
9. **Regional geography:** Madrid is overrepresented in the game; document Catalonia, Asturias, Basque Country, Galicia, Andalucía, Valencia, Castilla y León, islands.
10. **Quantitative calibration:** APM live-market series, public procurement archives, company accounts where available, equipment purchase announcements and fleet size claims.

---

# 14. Design conclusion (first-pass summary)

The historically interesting Spanish market is **not** "local companies plus Clair from 1966."

It looks more like:
- 1970s engineering-led domestic pioneers;
- 1980s regional/national PA houses growing with tours, municipal events and demanding riders;
- a network of Spanish manufacturers/importers feeding those firms;
- 1990s festivals, private TV and new regional integrated suppliers;
- 2000s municipal/festival/corporate expansion;
- a brutal 2009–13 squeeze that disproportionately hurts the middle;
- multinational ownership arriving in **specific transactions**, not by telepathy from a foreign founding date;
- companies changing business model, management and technical ecosystem over decades.

That is rich enough that rival companies can become actual historical actors rather than differently coloured instances of the same AI.

**Principle:** historical facts drive chronology and visible identities; AI weights are explicit game-design interpretations; uncertain dates stay uncertain until corroborated.


---

# 15. Regional production and infrastructure: the roster is not just Madrid PA

The previous roster is audio-heavy. A deeper pass shows that the Spanish market also contained **specialized staging, lighting, regional integrated-production and island firms** whose economics are different enough to deserve separate rival types.

## 15.1 Escenarios Valladar — Madrid / staging

**Evidence**
- Company history says **founded in 1980**.
- Specializes in rental/mounting of stages, anti-crush barriers, grandstands and structures for flown sound.
- Client classes include concert/event agencies, political parties, audiovisual firms, municipalities/public administrations, sports organizers, schools and universities.

Sources:
- https://escenariosvalladar.com/sobre-nosotros/
- https://escenariosvalladar.com/

**Gameplay**
- should not own PA simply because all rivals currently have all departments;
- sells **infrastructure capacity**: stage decks, towers, roofs, barriers, grandstands;
- municipal/political/event contracts can make it resilient when rock touring is weak;
- player and sound houses may subhire it for infrastructure rather than lose an entire job.

**Historical significance:** documented staging specialization from 1980 means a Spanish 1980s production should already be able to split audio and infrastructure between firms.

## 15.2 Tri i Talfis / TRI Escenarios — Madrid / rigging and stage infrastructure

**Evidence**
- Company says founded **1995** by spectacle-industry professionals with experience in major concerts, tours, political/cultural/sports events.
- Services include stages, sound/light towers, technical roofs, anti-crush barriers and qualified climbers/riggers/scaffolders.
- In **2012** Tri/Talfis and Sensei became Spanish partners/representatives for Mojo Barriers.
- In 2010 it worked with Madrid-region firefighters and others on a height-work safety manual and courses for spectacle assembly; early courses were held at the **Auditorio Miguel Ríos in Rivas-Vaciamadrid**.

Sources:
- https://www.triescenarios.com/
- https://www.triescenarios.com/cursos-formacion

**Gameplay**
- 1995 entry into dedicated staging/rigging market;
- post-2010 safety/training capability lowers structural incident risk;
- 2012 vendor relationship unlocks higher-grade crowd-barrier inventory;
- creates an actual reason for production companies to form long-term supplier partnerships.

## 15.3 Efectes — Mallorca / lighting

**Evidence**
- Efectes says its lineage reaches back to **1981**, when it became one of Mallorca's early dedicated lighting firms.
- Current work spans lighting design, audiovisual projects, spectacle/event lighting, rental and technical installation.

Source:
- https://www.efectes.com/

**Gameplay**
- an **island lighting specialist**, not generic national PA;
- shipping/ferry logistics and island stock availability matter;
- visiting national productions can subhire locally instead of trucking every lamp from the Peninsula;
- supports a distinct Balearic event/tourism economy.

## 15.4 Balear Acustic — Mallorca / integrated regional event supplier

**Evidence**
- Company material says operating from **1990** in Mallorca/Balearics.
- Offers sound, lighting, backline, stages/infrastructure and artist booking.
- Serves concerts, theatre, verbenas, fairs, sporting events and private work.

Source:
- https://www.balearacustic.com/

**Gameplay**
- island/regional integrated operator;
- benefits from local availability and backline;
- high ferry-cost moat against mainland competitors for small/medium work;
- tourism/private events smooth concert seasonality.

## 15.5 EMSAC — Galicia / integrated production and structures

**Evidence**
- EMSAC says founded **1993** in Galicia.
- From the beginning it combined **concert lighting, live sound, stage/stand/tent structures** and event production.
- HQ is in Barro, Pontevedra; it later operated nationally and with a Las Palmas delegation.
- Founder/administrator **Emilio Sacarrera Ruza** is independently described as administrator of Producciones EMSAC and responsible for major festival stages in Galicia.
- Associated production businesses extended into tents, film/TV production and artist booking.

Sources:
- https://emsac.com/empresa/
- https://emsac.com/servicios/produccion/
- https://www.lavozdegalicia.es/noticia/pontevedra/pontevedra/2021/12/25/cierra-mitica-discoteca-la-luna-tras-morir-repentinamente-uno-fundadores/00031640450686789922271.htm

**Named historical figure**
- **Emilio Sacarrera Ruza** — founder/administrator-level evidence, not merely a later technician.

**Gameplay**
- Galicia/North Portugal geographic niche;
- unusually broad integrated-production capacity;
- structures + sound + light reduce coordination/subhire overhead on festivals;
- higher capital and office requirements than a pure audio house.

## 15.6 Audioluz Canarias — Fuerteventura / island AV

**Evidence**
- Company states **Audioluz Canarias S.L. began in 1997**.
- Purpose: AV support for spectacle, cinema, theatre, dance, television, scenery and set work, primarily in Fuerteventura.
- Sound, lighting, video, transport and two warehouses are documented.

Sources:
- https://www.audioluz.com/quienes-somos/
- https://www.paginasamarillas.es/f/juan-gopar/audio-luz-canarias_015356421_000000001.html

**Gameplay**
- Canary Islands should not be a normal road-connected Spanish territory.
- Local stock has a huge freight advantage for island events.
- Mainland rivals can still fly people and ship equipment, but lead time and freight become material.
- Film/TV/corporate work gives a different demand mix from Peninsula touring.

## 15.7 Audiovisual Ojeda — El Puerto de Santa María / Cádiz

**Evidence**
- Company says **founded in 1992** in El Puerto de Santa María, Cádiz.
- Created to provide technical sound and lighting for spectacles/events; today includes video, projection, stages and grand support.

Source:
- https://www.sonido-ojeda.com/

**Gameplay**
- credible early-1990s Andalucía competitor independent of Sevilla cluster;
- useful for Cádiz/Jerez/coastal festival and municipal demand;
- starts sound/light, later grows audiovisual and structure capability.

## 15.8 Use Sonido — Valladolid / family succession

**Evidence**
- Company identifies founders **Eusebio Marchena and Carmen Herrero** and a family-business model spanning more than 30 years.
- Meyer Sound case study identifies **Eusebio Marchena as managing director** and **Oscar Marchena as technical director**.
- 2014 Meyer purchase for Sergio Dalma: **20 LYON, six 1100-LFC, six UPA-1P, Galileo Callisto processing**; equipment then slated for Manuel Carrasco.
- 2025 BORME records administrators **Eusebio Marchena, Carmen Herrero and Oscar Marchena**.

Sources:
- https://www.usesonido.com/quienes-somos/
- https://meyersound.com/news/use-sonido/
- https://www.boe.es/diario_borme/txt.php?id=BORME-A-2025-30-47

**Named people**
- Eusebio Marchena — founder / managing director.
- Carmen Herrero — founder / administrator.
- Oscar Marchena — technical director; later administrator.

**Gameplay**
- a strong example of **family succession** without acquisition;
- technical-director role can drive equipment strategy;
- later-era premium Meyer investment is sourceable down to actual system quantities;
- a rival need not change identity when leadership expands to a second generation.

---

# 16. Promoters and buyers: a second historical graph

Rental firms respond to promoters. The Spanish market cannot be reproduced by simulating suppliers while generating anonymous clients.

## 16.1 Gay Mercader / Gay & Company / Gamerco

**Evidence**
- Gay Mercader began promoting in **1971** and founded **Gay & Company in 1973**.
- His organisation was among the key routes by which major international rock acts entered Spain; the Rolling Stones' 1976 Barcelona show is a major marker.
- Contemporary/retrospective sources stress that Spain initially lacked the infrastructure for international rock touring.
- **Live Nation acquired Gamerco in December 2006**, providing a documented foreign multinational acquisition in the **promoter** market five years before PRG's local technical-production acquisition.

Sources:
- https://www.gaymercader.com/
- https://elpais.com/elpais/2017/12/18/eps/1513624424_368422.html
- https://elpais.com/diario/2006/12/22/cultura/1166742002_850215.html
- https://www.rtve.es/play/noticias/20210513/gay-mercader-50-anos-organizando-conciertos/2088864.shtml

**Gameplay**
- 1970s international-touring demand grows through promoter access before foreign rental houses own Spanish depots;
- a promoter can bring a foreign artist + foreign touring supplier while still buying local stage/power/labour;
- 2006 Live Nation ownership changes promoter capital/network access, **not automatically the local rental-company roster**.

This is the cleanest proof that we need separate ownership timelines by market layer.

## 16.2 Doctor Music — Neo Sala

**Evidence**
- Doctor Music dates its first concert to **12 February 1982**: Obús + Starshooter at Palau Blaugrana II.
- Founder: **Neo Sala**.
- Doctor Music explicitly describes the contemporary Spanish international-touring market as underdeveloped after years of isolation.
- **Tina Turner in 1987** is cited by the company as the major breakthrough that opened international-circuit relationships.

Sources:
- https://www.doctormusic.com/noticia-doctor-music-treinta-anos-en-la-carretera-28-febrero-2012
- https://elpais.com/ccaa/2012/10/25/madrid/1351186745_598543.html

**Gameplay**
- new promoters increase high-tier international offers before they increase domestic supplier count;
- promoter reputation with agents controls availability of major tours;
- production risk rises because infrastructure has to catch up with rapidly larger shows.

## 16.3 Tratos Producciones — Valencia / Vicente Mañó Guillén

**Evidence**
- Tratos says founded **1983** in Valencia by **Vicente Mañó Guillén**.
- Early international concerts included Depeche Mode, Deacon Blue and Aztec Camera.
- **1991:** began producing Fallas concerts in Alameda, described as mass free events exceeding 100,000 people per night and broadcast by Canal+.
- Company says it ultimately managed more than 5,000 events.

Source:
- https://tratos.com/sobre-nosotros/

**Gameplay**
- gives Valencia a documented promoter anchor;
- Fallas creates a recurring municipal/mass-event peak with broadcast requirements;
- local suppliers can grow around a stable promoter/public-event ecosystem instead of every region being fed randomly from Madrid.

## 16.4 The Project — Barcelona / Tito Ramoneda and Joan Rosselló

**Evidence**
- Founded **1988** by **Tito Ramoneda and Joan Rosselló**.
- Ramoneda had previously worked at Doctor Music.
- Company became a major Barcelona/Catalonia promoter across tours and festivals.
- Warner Music acquired **100% in 2024**, while the existing management/brand continued.

Sources:
- https://www.3cat.cat/3catinfo/warner-music-compra-promotora-concerts-catalana-que-mou-500000-espectadors-lany/noticia/3317165/
- https://www.cugat.cat/noticies/tito-ramoneda-sant-cugat-es-una-ciutat-que-aposta-per-la-musica/
- https://www.ara.cat/cultura/musica/mor-joan-rossello-cofundador-the-project_1_5177633.html

**Gameplay**
- promoter spin-off / employee entrepreneurship: Doctor Music experience contributes to a new competitor;
- later foreign acquisition leaves local company identity and relationships largely intact;
- same acquisition-continuity mechanics as rental firms can be reused on the client side.

## 16.5 Last Tour — Bilbao / Basque festival ecosystem

**Evidence**
- APM industry directory records **Last Tour: company from 2002, Bilbao**.
- The legal Last Tour International S.L. began operations in early **2003**.
- First Azkena Rock Festival was held in **2002** under predecessor/promoter **Muskerra**.
- Bilbao's 2006 municipal report records Last Tour International as partner on the first Bilbao Live Festival, attended by 43,616 people.

Sources:
- APM 2021 yearbook: https://www.afial.net/wp-content/uploads/2021/04/ANUARIO-APM-2021-WEB.pdf
- https://www.iberinform.es/empresa/802001/last-tour-international
- Bilbao 2006 municipal report
- https://lasttour.org/es/somos/

**Gameplay**
- promoter/festival firm can emerge from a predecessor rather than from nowhere;
- Basque high-tier demand accelerates in the 2000s around festival creation;
- creates local repeat production contracts and a reason for north-Spain technical branches.

---

# 17. A concrete historical sequence for foreign participation

The phrase "foreign player arrived in Spain" is meaningless without specifying the layer.

| Date | Layer | Event | Simulation meaning |
|---:|---|---|---|
| 1970s onward | touring | foreign acts/suppliers periodically enter with tours | temporary foreign supplier attached to specific gig/tour; no local depot |
| 2000/01 | AV ownership | Euphon acquires 60% of Sono | foreign equity in Spanish AV/integration company |
| **2006** | promoter ownership | Live Nation acquires Gamerco | foreign promoter network becomes locally embedded |
| **2011** | technical production/rental | PRG acquires Spanish Sound and Light Productions through EML/First Events deal | locally embedded multinational production/rental competitor |
| 2012 | technical-production branding | Spanish company transitions to PRG name | ownership/name event, assets and staff persist |
| 2024 | promoter ownership | Warner buys The Project | another foreign ownership event without erasing domestic operating identity |
| 2020s | AV/rental consolidation | further international-group local structures | research each independently; no global \`'*'\` shortcut |

**Result:** the user's intuition is substantially right for **permanent multinational technical-rental competition**, while the broader live industry had foreign artists, suppliers, investors and promoter ownership earlier.

---

# 18. Public procurement is not background flavour

Regional/public buyers were and remain structurally important.

A current Basque public tender illustrates the contract structure clearly: Galdakao tendered annual **sound + lighting + technical assistance + concert production** as one service, with rider documents and stage documentation included. Another Donostia framework covers sound/lighting for Aste Nagusia.

Sources:
- Basque procurement portal, Santakurtzak 2026
- Basque procurement portal, Aste Nagusia 2026–2029

The historical trade retrospective likewise identifies municipalities as a major client class and slow payment as an industry problem.

**Gameplay proposal**
- \`ClientKind = promoter | municipality | festival | broadcaster | venue | corporate | political | artist\`.
- Public clients have tenders, qualification requirements, annual budget cycles and payment distributions.
- A local regional firm may survive by winning repeat public frameworks even when touring demand collapses.
- Procurement can bundle departments, which rewards integrated suppliers such as EMSAC/Fluge but still permits subcontracting.
- Framework wins should be persistent contracts, not a random daily offer.

---

# 19. Equipment should follow companies and suppliers, not just calendar year

The deeper company research gives enough evidence to start creating **documented equipment eras** without guessing entire inventories.

| Firm | Era | Documented equipment / relationship | Safe game use |
|---|---|---|---|
| Twin Cam | early lineage | Meyer importer relationship | earlier/easier Meyer access and support |
| Twin Cam | later | L-Acoustics; later DiGiCo documented | premium rider-oriented transition |
| Sorter | early | self-built systems | repair/engineering advantage, weaker rider acceptance |
| Sorter | later | EAW then L-Acoustics | explicit fleet-era transitions |
| Pronorte | 2007 | EAW KF730 | repeat touring/client relationship + EAW expertise |
| Milán | FIB-era | Meyer Sound + Soundcraft Vi6 | premium sound investment |
| Use Sonido | 2014 | 20 LYON, 6×1100-LFC, 6×UPA-1P, Galileo Callisto | exact capital purchase can be represented |
| Fluge | multiple eras | Meyer early; later multi-brand high-end fleet | integrated purchasing strategy, not one permanent brand |
| Tri/Talfis | 2012 | Mojo Barriers relationship | infrastructure supplier unlock |

A historical company should therefore have **equipment eras**, for example:
\`\`\`ts
inventoryPolicies: [
  { from: 1983, strategy: 'repair-and-self-build' },
  { from: 1991, preferredBrands: ['EAW'] },
  { from: 2004, preferredBrands: ['L-Acoustics'] },
]
\`\`\`
The dates above are placeholders unless specifically sourced; only encode a date when evidence exists.

---

# 20. Leadership and technical-role graph, expanded

The game should model at least three kinds of historical person:

### Owner / managing leader
Controls capital allocation, expansion, acquisition and business-line changes.

Examples now sourceable:
- Luis Berlanga — Fluge founder/president.
- José Javier García "Boby" — Pronorte founder/manager.
- Eusebio Marchena — Use Sonido founder/managing director.
- Carmen Herrero — Use Sonido founder/administrator.
- Emilio Sacarrera Ruza — EMSAC founder/administrator-level evidence.
- Gaspar Bestard — Sono director general in 2001.
- Rafael Campos — Twin Cam managing director in 1994.

### Technical leader
Affects systems engineering, technology adoption, training and quality but need not own the firm.

Examples:
- James Woods — Berenice engineer → Meyer/CYP → Twin Cam Technical Director → Woods Engineering.
- Oscar Marchena — Use Sonido technical director.
- José Antonio Caballero — later Sorter production/concert-setup responsibility.
- Pablo Jiménez — later Twin Cam audio leadership/contact.

### Promoter / buyer leader
Changes the *demand network*, not the rental rival AI.

Examples:
- Gay Mercader — Gay & Company/Gamerco.
- Neo Sala — Doctor Music.
- Vicente Mañó Guillén — Tratos.
- Tito Ramoneda + Joan Rosselló — The Project.
- José Javier Arnaiz — documented in Last Tour corporate/legal history, but research role chronology before turning him into a gameplay biography.

This lets a famous promoter affect which artists/tours appear and which suppliers get repeat contracts without pretending the promoter owns speakers.

---

# 21. New historical mechanics implied by the evidence

## Local subhire network
A Barcelona tour supplier should be able to source local lighting, stage or backline without opening a permanent branch.

## Talent migration
Technicians move between companies and can create new firms; technical knowledge follows people.

## Spin-offs
Espiral's ecosystem shows how engineering firms can generate manufacturers/distributors. A mature technical company can seed future market actors.

## Strategy pivots
Soinua shifts from live production toward distribution; Milán expands installation/services; Sono specializes differently from touring PA. A company can leave one market without going bankrupt.

## Acquisition continuity
Gamerco→Live Nation, EML/Spanish operation→PRG, The Project→Warner. Ownership changes do not wipe staff, customers or operational history.

## Regional moats
Islands, Galicia/North Portugal, Asturias, Basque Country and Castilla y León have real logistical/client advantages. National firms should need depots or partners to contest small regional work efficiently.

## Department specialization
A stage firm is not a poor sound company. A lighting firm is not missing audio inventory. Rival capability should be sparse and specialized.

---

# 22. Revised candidate roster by market role

### Touring / concert audio
Milán Acústica; Espiral; LIL/Twin Cam; Berenice; Sorter; Pronorte; Fluge; Soinua; Use Sonido; Prosoda/RCA lineage; selected Andalucía firms.

### Integrated regional production
EMSAC; TCM Audiovisión; Audiovisual Ojeda; Audioluz Canarias; Balear Acustic; later Fluge.

### Lighting specialists
Efectes (Mallorca, lineage 1981); more Madrid/Barcelona lighting-only firms still need sourcing.

### Staging / structures / rigging
Escenarios Valladar (1980); Tri/Talfis (1995); EMSAC (integrated); more regional structure suppliers still need sourcing.

### AV/integration
Sono; Milán Miscelánea; TCM; later integrated suppliers.

### Promoters / recurring buyers
Gay & Company/Gamerco/Live Nation; Doctor Music; Tratos; The Project; Last Tour; later festival-specific promoters.

### International visiting suppliers
Clair, Brit Row, Showco etc. **Only on the relevant touring contract unless/ until a documented Spanish local presence exists.**

---

# 23. Historical-data schema proposed for implementation

\`\`\`ts
interface HistoricalCompanyTemplate {
  id: string
  displayName: string
  country: CountryCode
  homeRegion?: string

  founded?: HistoricalDate
  liveRentalEntry?: HistoricalDate
  nationalTouringEntry?: HistoricalDate

  businessLines: BusinessLineEra[]
  scale: ScaleEra[]
  names?: NameEra[]
  ownership?: OwnershipEvent[]
  equipment?: EquipmentEra[]
  leaders?: HistoricalLeaderRef[]

  sources: SourceRef[]
}

type Confidence = 'A' | 'B' | 'C' | 'D'

interface HistoricalDate {
  year: number
  confidence: Confidence
  note?: string
}

interface BusinessLineEra {
  from: number
  to?: number
  lines: Array<'touring-audio'|'lighting'|'video'|'staging'|'rigging'|'backline'|'corporate-av'|'installation'|'distribution'|'promoter'>
}

interface RivalStrategyEra {
  companyId: string
  from: number
  to?: number
  // fictional model parameters informed by documented business activity
  strategyId: string
}
\`\`\`

A sourceable historical fact lives in the company record. A tuning number lives in the separate strategy record. That boundary should remain hard.

---

# 24. Expanded test matrix

The eventual implementation should snapshot the market composition itself.

### ES 1980
Expected classes:
- domestic audio pioneers;
- Madrid staging available;
- Mallorca lighting lineage may begin;
- international suppliers only via visiting tours.
Forbidden:
- permanent local Clair/PRG/Solotech depot.

### ES 1985
- Pronorte appears in Gijón;
- promoter ecosystem includes Gay & Company, Doctor Music, Tratos;
- international tour demand materially higher than 1975;
- public/verbena market still important.

### ES 1993
- Fluge, Soinua, Prosoda, EMSAC, Ojeda, Apogee legal entity and regional Andalucía/Galicia growth can be represented according to confidence.
- post-1992 event capital/talent effects can persist temporarily.
- staging and production can be sourced independently.

### ES 2000
- festival/private-TV/corporate/integration channels are substantial;
- Sono foreign-equity event can occur;
- promoter/rental ownership remains separate.

### ES 2006
- Live Nation can acquire Gamerco on the **promoter graph**;
- this must not magically create PRG/Clair Spanish warehouses.

### ES 2011
- PRG technical-production acquisition can occur and inherit Spanish predecessor operations.

### ES 2015
- Soinua can pivot toward distribution;
- regional suppliers still matter despite national integrated firms.

### ES 2024
- The Project can be acquired by Warner while continuing with existing local identity/management.
- promoter consolidation and rental consolidation remain separate graphs.

---

# 25. Research status after v0.3 pass

**High-confidence additions this pass**
- Escenarios Valladar 1980, Madrid staging.
- Efectes lighting lineage 1981, Mallorca.
- Tratos 1983, Vicente Mañó, Valencia promoter/producer.
- EMSAC 1993, Galicia integrated production; Emilio Sacarrera.
- Tri/Talfis 1995, Madrid staging/rigging; Mojo relationship 2012.
- Audioluz Canarias 1997, Fuerteventura AV.
- Audiovisual Ojeda 1992, Cádiz.
- promoter ownership transition Gamerco→Live Nation 2006.
- The Project 1988 and Warner ownership 2024.
- expanded Use Sonido leadership/equipment evidence.

**Still weak / needs another pass**
- exact Berenice start/end and ownership;
- exact Sorter incorporation/founders;
- LIL Service → Twin Cam legal/name chronology;
- Sonido Tole identity/history;
- Barcelona/Madrid lighting-only firms of the 1980s/90s;
- Valencian technical-rental firms separate from promoters;
- historic Basque technical suppliers before the modern Fluge/ABS structures;
- Galicia video/lighting firms before 1993;
- Canarias before Audioluz 1997;
- stage/roof vendors serving the earliest 1970s international stadium shows.

The remaining uncertainty is now visible instead of being filled with invented dates, which is already an improvement over the current \`companies.ts\`.


---

# 26. Hard-target resolution: Berenice, Sorter, Twin Cam and Apogee

This pass resolves several dates that were previously guesses in \`companies.ts\`.

## 26.1 Berenice Concert Systems — legal entity 1986, earlier activity still ambiguous

**New hard evidence**
- **BERENICE CONCERT SYSTEMS S.A.**, CIF A78207503, is reported as incorporated **1 October 1986** in Madrid.
- Registered address: Paseo de Extremadura 153.
- Last available deposited accounts in the commercial-data source are from 1995.
- The NIF was later included in a 2017 tax-registration revocation publication.
- James Woods' documented career still confirms Berenice as a real Madrid concert-audio employer before his later Meyer/Twin Cam roles.
- Multiple technician CV/career records claim Berenice work stretching into the 1980s, including one claim from 1980; these are useful clues but weaker than the company-registration date.

Sources:
- https://www.axesor.es/Informes-Empresas/170617/BERENICE_CONCERT_SYSTEMS_SA.html
- https://www.boe.es/buscar/doc.php?id=BOE-A-2017-11306
- https://www.prosoundweb.com/rational-acoustics-appoints-woods-engineering-as-official-smaart-instructors/

**Revised interpretation**
- \`legalEntityFrom: 1986 (A/B confidence)\`.
- Do **not** keep the current exact 1982 entry as fact.
- Preserve a research note that a predecessor/brand/operation may have existed before incorporation.
- If gameplay needs a pre-1986 Berenice presence, use an explicitly approximate predecessor era rather than falsifying the S.A. incorporation date.

## 26.2 Sorter S.A. — exact legal formation in 1986

**New hard evidence**
- Sorter S.A., CIF A78282985, has a documented **1986 incorporation**. Commercial sources disagree on the exact registry date (25 April vs 31 October), so use **1986** until the original registry record is retrieved.
- Corporate object/activity is explicitly described as **sound reinforcement services for shows**.
- Trade history independently says Sorter was created by a **group of musicians in the 1980s**, initially using self-built systems, then large EAW inventories, later L-Acoustics.
- Sorter says it worked major projects including Noches del Botánico, Serrat/Sabina, Mad Cool and Bruno Mars.
- ISP source states Sorter had worked with L-Acoustics since **1997**.
- Modern technical leadership is better sourced:
  - **Roke/Roque Peña** — technical director.
  - **José Antonio Caballero** — operations / event-production role.
  - **Gerson Acha Gómez** and **Roque Hernández Peña** — administrators documented from 2010 onward.
  - **José María Rosillo** — monitor engineer on the El Gusto Es Nuestro 20 Años tour, a technical collaborator rather than corporate leader.

Sources:
- https://www.axesor.es/Informes-Empresas/229857/SORTER_SA.html
- https://empresite.eleconomista.es/SORTER.html
- https://www.sorter.es/
- https://instalia.eu/conciertos-pesos-pesados-sonorizacion/
- https://www.isp-audio.com/instalaciones/instalacion-fija-audio/4806-crew-nation-presenta-en-un-espectaculo-ambientado-por-l-acoustics
- https://www.isp-audio.com/instalaciones/event-staging/862-allen-heath-dlive-me1-son-solucion-integrada-mezcla-monitores-iem-gira-gusto-nuestro-20-anos
- https://www.datoscif.es/empresa/sorter-sa

**Current game correction**
- replace hard-coded **1984** with **1986 legal entity** unless a sourced predecessor is found.

**Gameplay**
- the self-build → EAW → L-Acoustics progression is now one of the strongest documented examples for equipment-era evolution.
- L-Acoustics relationship can safely be active by 1997.
- current administrators/technical leaders must not be back-projected into the founding era.

## 26.3 Twin Cam — 1990 is now strongly supported as the corporate formation era

**New hard evidence**
- **Twin Cam Audio Performance S.L.** was registered/activated in **March 1990**; stated purpose: rental of sound equipment.
- **Twin Cam Audio International S.L.** was incorporated **25 April 1990**; object includes export/import/commercialization/rental/sale/advice for sound and recording equipment.
- The International entity's recorded former names include **TWIN-CAM-AUDIO SOCIEDAD LIMITADA**.
- This strongly supports **1990 as the Twin Cam corporate formation/restructuring era**.
- It still does **not** prove that LIL Service legally changed its name to Twin Cam in a single documented rename transaction.
- Rafael Campos is independently documented as managing director of Twin Cam Audio Performance in a 1994 directory.
- James Woods is independently documented as later Technical Director at Twin Cam before founding Woods Engineering in 1999.

Sources:
- https://www.einforma.com/informacion-empresa/twin-cam-audio-performance
- https://www.iberinform.es/empresa/171345/twin-cam-audio-international
- https://lei.bloomberg.com/leis/view/959800BMEMRDM0BRQL55
- 1994 International Recording Directory / World Radio History
- https://www.prosoundweb.com/rational-acoustics-appoints-woods-engineering-as-official-smaart-instructors/

**Revised interpretation**
- \`LIL Service lineage: 1979\` remains a trade-history claim.
- \`Twin Cam corporate era: 1990\` is now strongly supported.
- Model this as **lineage/predecessor → 1990 corporate transition**, with wording that avoids claiming an unverified legal rename.

This means the existing game's 1990 transition was accidentally close to reality, but the comment claiming a specific rename mechanism was too confident.

## 26.4 Apogee Servicios — 1993, not 1985

**Hard evidence**
- **Apogee Servicios S.L.**, CIF B41614678, constituted **3 August 1993** in Valencina de la Concepción, Sevilla.
- Corporate object explicitly covered **purchase, sale, rental, repair, distribution, installation and representation of sound, lighting, video and electronic equipment**.
- Company records show **27 employees** in the historical extract and accounts deposited for 1997.
- 1998 corporate records identify:
  - **Miguel Ángel Fragio Díaz** — administrator.
  - **Noemí Márquez Castellano** — administrator.
  - **Jorge Luis Fragio Díaz** — power of attorney.
  - **Oscar Fragio Díaz** — power of attorney.
- Later administrative records indicate the company became inactive/revoked; the exact end of live operations needs reconstruction separately.

Sources:
- https://www.iberinform.es/empresa/337044/apogee-servicios
- https://www.axesor.es/Informes-Empresas/626426/APOGEE_SERVICIOS_SL.html

**Current game correction**
- **1985 is unsupported and should be removed.**
- use **1993** for the documented company unless an earlier predecessor is discovered.

**Gameplay**
- this is a genuinely integrated sound/light/video/rental/repair business, not merely an audio house;
- Andalucía's 1990s market should therefore contain more cross-department competition than the current roster suggests.

---

# 27. Lighting history: first solid specialist outside audio

## Arcoiris Lighting Systems — Barcelona / Montcada i Reixac

**Evidence**
- Company profile states **founded in 1983**.
- Created specifically around **professional lighting rental**.
- Services evolved from lighting into design, production, rental/sales and some integrated sound/event services.
- HQ in Montcada i Reixac, Barcelona.

Source:
- https://www.linkedin.com/company/arcoiris-lighting-systems-s-a-

**Why this matters**
This fills a major hole in the current Spanish roster. In an early-1990s Barcelona production, the lighting competitor should not just be Twin Cam with a generated lighting inventory. A dedicated lighting house existed.

**Gameplay**
- add as a Catalan **lighting-specialist rival from 1983**;
- high lighting depth, weak/zero early audio inventory;
- likely partner/subhire target for audio houses;
- later service broadening can be represented by a business-line era change.

Together with Mallorca's Efectes (1981), this proves dedicated Spanish lighting suppliers existed early enough that department-specialized rivalry should be present from the 1980s.

---

# 28. A revised Spain roster by 1995

By 1995, a historically credible Spanish game should be able to draw from a roster roughly like this, subject to final source confidence and map size:

### Madrid / central
- Milán Acústica — audio, 1976.
- Espiral — engineering/audio, 1977; live rental early 1980s.
- Berenice Concert Systems — documented S.A. 1986; concert audio.
- Sorter — documented S.A. 1986; concert audio.
- Fluge — 1990, initially live sound, diversifying.
- Escenarios Valladar — staging/infrastructure, 1980.
- Tri/Talfis — staging/rigging, 1995.

### Barcelona / Catalonia
- LIL Service lineage — reported from 1979.
- Twin Cam corporate entities — 1990.
- Arcoiris Lighting — lighting rental, 1983.
- Sono — AV/integration lineage from 1972.
- promoter demand from Gay & Company/Gamerco, Doctor Music and The Project.

### Asturias / north
- Pronorte — Gijón, 1985.
- strong municipal/regional touring role.

### Basque market
- promoter/festival layer still needs pre-2000 technical-supplier research.
- do not fill this gap by spawning international \`'*'\` houses.

### Galicia
- EMSAC — 1993, integrated sound/light/stage.
- regional public/festival infrastructure market.
- Iluminaciones Vázquez/Santiaguesas lineage provides an additional electrical/event-lighting lineage from 1980/1990, but it is decorative/event electrical work rather than a pure concert-lighting house and should be typed accordingly.

Source:
- https://santiaguesas.com/

### Castilla y León
- Use Sonido — family sound/light provider, exact start still being narrowed.
- strong national-touring evidence by the 2000s.

### Valencia
- strong promoter/client ecosystem: Tratos from 1983.
- technical-rental firm research still incomplete; **do not convert Tratos into a rental rival**.

### Andalucía
- Sonorock active early 1990s.
- Audiovisual Ojeda 1992.
- Apogee Servicios 1993.
- TCM active by 1994.
- Daniel Sonido documented by 1991.
- this is enough evidence to make Andalucía a real regional technical market rather than one generic Sevilla rival.

### Balearics
- Efectes lighting lineage 1981.
- Balear Acustic around 1990.
- strong local logistics moat and tourism/private-event market.

### Canaries
- Audioluz Canarias 1997 falls just outside this snapshot.
- pre-1997 local supplier history remains a research gap.

**Key result:** even before the late-2000s multinational era, Spain is already a **multi-region, multi-specialty domestic production market**. What it lacks is not competition. What it lacks is permanently embedded foreign technical-production groups.

---

# 29. Current implementation implications, now more concrete

The next code pass can be much less speculative:

1. Replace \`RivalTemplate.enters\` with at least \`localOperatingSince\` and optional \`predecessorSince\`.
2. Add a \`businessLines\` mask so Arcoiris, Valladar, Efectes and similar firms do not materialize with generic audio+video+stage stock.
3. Stop \`countries:['*']\` from granting a local Spanish warehouse.
4. Correct sourceable dates immediately:
   - Milán 1976
   - Pronorte 1985 / Gijón
   - Sorter 1986
   - Berenice legal company 1986 (predecessor uncertain)
   - Fluge 1990
   - Twin Cam corporate era 1990
   - Ojeda 1992
   - Apogee 1993
   - EMSAC 1993
   - Tri/Talfis 1995
   - Audioluz Canarias 1997
5. Add Espiral, Arcoiris, Valladar, Efectes, EMSAC, Ojeda and Use Sonido as distinct candidate rivals, gated by relevant map regions/business lines.
6. Add promoter records separately for Gay/Gamerco, Doctor Music, Tratos, The Project and Last Tour.
7. Treat PRG 2011 as an ownership/acquisition event, not a greenfield spawn.
8. Introduce technical-person records only where roles are documented; do not invent founders for Berenice/Sorter/Twin Cam.
9. Snapshot-test ES market composition at 1980/1985/1990/1995/2000/2006/2011/2020.

At this point the evidence is deep enough to begin implementing **Phase 1 chronology + specialization** without waiting for every last historical hole to close.


---

# 30. Further regional depth: family firms, second-generation succession and dense local markets

The surviving-company histories make clear that the Spanish market was not only made of nationally visible tour suppliers. Regional technical economies often contained several overlapping family/small-company operators doing municipal, political, cultural and commercial work.

## 30.1 Megafer — Ferrol / Galicia

**Evidence**
- Megafer states it has operated in Ferrol since **1980**.
- It began with **two people**, using **Semprini and Peavey** equipment.
- In **1995**, **Celso Javier**, the founder's son, took over direction.
- The new era added equipment from **DAS, Beyma, Ecler, Yamaha, Studiomaster, AKG, Shure and Sennheiser**.
- Services broadened from sound into lighting, video projection, tents, stages and decks.
- Client list is heavily regional/public/institutional: Ferrol-area municipalities, unions, cultural groups, health training, sports and local festivities.
- Modern company says it maintains three permanent vehicles.

Sources:
- https://www.megafer-sonido.com/
- https://www.megafer-sonido.com/servicios-sonido-iluminacion-ferrol.aspx

**Gameplay**
- this is a near-perfect historical template for a **small regional incumbent**;
- starts tiny, with modest equipment;
- can survive for decades through repeat public/institutional relationships without ever becoming Fluge;
- family succession in 1995 can trigger a new investment/equipment strategy;
- domestic brands and serviceability matter;
- regional public-market depth is enough to sustain a company with a small fleet.

This is a useful counterexample to a growth model in which every healthy rival inevitably becomes national.

## 30.2 Swing Electroshow — Valladolid / Castilla y León

**Evidence**
- Trade listings describe Swing Electroshow as operating since **1987** in technical event production, sound and professional lighting, touring with national/international artists.
- LinkedIn company history gives a slightly earlier **1985** foundation. Because sources conflict, store \`founded: 1985–1987\` until registry evidence is found.
- Current company describes sound, lighting, video, stages and production.
- A **2008 International Talent & Touring Guide** lists Swing Electroshow in La Cistérniga, Valladolid, under *Sound, Lighting & Stage Services*, with **Manuel Rodríguez** as director and **Juan Carlos** in commercial.
- That same guide places multiple competing technical suppliers in Valladolid.

Sources:
- https://www.swingelectroshow.com/
- https://www.europages.es/ (Swing Electroshow listing)
- 2008 International Talent & Touring Guide, World Radio History

**Gameplay**
- another regional integrated provider with real touring reach;
- foundation confidence should remain a range until the registry is checked;
- manager identity from a 2008 directory applies to that era, not necessarily the founding era.

## 30.3 Real Audio Systems — Valladolid

**Evidence**
- 2008 International Talent & Touring Guide lists **Real Audio Systems** under Valladolid sound/light/stage services:
  - **José Luis Rico** — managing director.
  - **Andrés Rico** — sound technician.
- BORME confirms **José Luis Rico Pinto** was administrator until **2009**, when **Andrés Rico Pinto** became sole administrator.
- The company was voluntarily dissolved and extinguished in **2018**, with Andrés Rico Pinto as liquidator.

Sources:
- 2008 International Talent & Touring Guide, World Radio History.
- https://boe.es/diario_borme/txt.php?id=BORME-A-2009-221-47
- https://www.boe.es/diario_borme/txt.php?id=BORME-A-2019-3-47

**Gameplay**
- a documented **leadership succession** from José Luis to Andrés;
- unlike an acquisition, the company identity remains while management changes;
- eventual voluntary closure demonstrates another rival exit path besides bankruptcy or acquisition.

## 30.4 Ingunza Audiovisual — Bilbao / Euskadi

**Evidence**
- 2008 International Talent & Touring Guide lists:
  - **Patxi Ingunza** — managing director.
  - **Julio Pascual** — technician.
- Later Bilbao procurement records show **Ingunza Audiovisual S.L.** winning/participating in municipal sound and lighting work for **Aste Nagusia** alongside Audiomic Producciones.
- Julio Pascual's professional profile still associates him with Ingunza Audiovisual.

Sources:
- 2008 International Talent & Touring Guide, World Radio History.
- https://es.openprocurements.com/tender/2016-servicio-de-iluminacion-y-sonido-para-los-conciertos-a-celebrar-en-aste-nagusia/
- https://www.bilbao.eus/cs/BlobServer?blobcol=urldata&blobheader=application%2Fpdf&blobheadername1=Content-disposition&blobheadername2=pragma&blobheadervalue1=attachment%3B+filename%3D2016_GASTO+MENOR+1T2T3T4T.pdf&blobheadervalue2=public&blobkey=id&blobtable=MungoBlobs&blobwhere=1274142044281

**Gameplay**
- gives Euskadi a concrete technical supplier rather than only a promoter/festival layer;
- municipal festival frameworks can create sticky recurring revenue;
- public contracts can be split among several technical vendors rather than winner-takes-all.

## 30.5 The important density lesson

The 2008 touring guide lists, in **Valladolid alone**, multiple Sound/Lighting/Stage suppliers:
- Alacrán Producciones — MD José Luis García.
- Real Audio Systems — MD José Luis Rico; sound technician Andrés Rico.
- Swing Electroshow — director Manuel Rodríguez; commercial Juan Carlos.

It also lists Ingunza Audiovisual in Vizcaya.

Source:
- 2008 International Talent & Touring Guide, World Radio History.

A historical simulation should therefore **not** interpret the research roster as "spawn every named company". There were too many firms, especially at regional tiers.

A better architecture is:

\`\`\`ts
HistoricalActorPool {
  country: 'ES'
  region: 'castilla-leon'
  actors: [...]
  minActive: 2
  maxActive: 4
}
\`\`\`

The simulation deterministically selects a historically plausible subset for a seed, while **must-have national actors** and historically important lineages remain fixed.

That keeps the map legible while preserving real market density and replay variation.

---

# 31. Arcoiris Lighting: founder and specialist lineage now sourceable

## Arcoiris Lighting Systems — Barcelona / Montcada i Reixac

**Evidence**
- Official company history states the project began in **1983** from the vision of **Toni Juncosa**.
- Company identifies itself as an early professional spectacular-lighting specialist and later expanded into sound, production, fixed installation and sales.
- Current leadership page names:
  - **Toni Juncosa — CEO**
  - **José Mª Galdeano — commercial and production director**
  - **Ruth Juncosa — executive director**
- A later industry post describes Toni Juncosa as one of the pioneers of Spanish entertainment lighting; use that only as secondary context, not as a quantitative claim.

Sources:
- https://arcoirislighting.com/
- https://arcoirislighting.com/nosotros

**Gameplay**
- **Toni Juncosa** can safely be attached to the founding/company-leadership lineage.
- Do not back-project Ruth Juncosa or José Mª Galdeano into 1983 without tenure evidence.
- 1980s Arcoiris should be a **lighting specialist**, not an integrated generic rival.
- Later business-line expansion can add audio/production capabilities.
- Barcelona can now support historically separate **audio (LIL/Twin Cam), lighting (Arcoiris), AV/integration (Sono)** actors.

This makes cross-company package assembly historically plausible rather than artificial.

---

# 32. Fluge's origin directly supports a subcontracting/partner system

A 2021 interview with Luis Berlanga gives unusually explicit evidence about the market structure around Fluge's foundation.

**Documented statements**
- Fluge was formed in **1990**.
- Its principal activity was **live sound production**.
- Berlanga describes the live-production industry at the time as segmented into **specialist companies for each service**.
- He says Fluge relied on **external lighting companies** because managers/producers increasingly demanded an integrated, coordinated service, leading Fluge to make agreements with companies in that sector.
- A later 2019 interview independently confirms the same starting point: Fluge began in 1990 as a sound company for artist tours and expanded into light/video.

Sources:
- A.R.T.E., *Escenarios* no. 230, Luis Berlanga interview:
  https://arte-asoc.es/wp-content/uploads/2021/09/Revista-ESCENARIOS-230.pdf
- https://allmusicspain.com/entrevistas/entrevista-a-luis-berlanga-fundador-y-principal-responsable-de-fluge-audiovisuales/

**This is not merely flavour. It validates a mechanic:**

\`\`\`ts
interface SupplierRelationship {
  buyerCompanyId: string
  supplierCompanyId: string
  businessLine: BusinessLine
  trust: number
  preferred: boolean
  since?: number
}
\`\`\`

A sound firm can bid an integrated job using a **preferred lighting/staging partner** rather than needing owned stock in every department.

Potential consequences:
- margin is shared;
- coordination quality depends on relationship;
- repeated work builds trust;
- the supplier can be unavailable;
- the partner gains turnover/reputation;
- a company may later internalize the department if volume justifies investment;
- acquisition/hiring can bring the capability in-house.

This gives a historical path:
**specialist → partner network → integrated supplier**, instead of every rival spawning with all departments.

---

# 33. Technical talent as a transferable industrial asset

James Woods is the clearest sourced example so far:

**Career chain**
1. audio engineer, **Berenice Concert Systems**, Madrid;
2. Meyer Sound product specialist, **CYP Internacional**;
3. Technical Director, **Twin Cam Audio**, Barcelona;
4. later Senior Project Manager at MAVCO, Miami;
5. founded **Woods Engineering** in 1999;
6. Woods Engineering became a Smaart training provider in Europe.

Source:
- https://www.prosoundweb.com/rational-acoustics-appoints-woods-engineering-as-official-smaart-instructors/

This supports a system where technical people carry:
- manufacturer knowledge;
- systems-engineering capability;
- training effects;
- professional-network access;
- possibly client/rider confidence.

It **does not** justify assigning unsupported personality values.

A useful mechanic is:
\`\`\`ts
TechnicalFigure {
  role: 'system-engineer' | 'technical-director' | 'foh' | 'lighting-designer' | ...
  expertise: string[]
  career: { companyId: string, from?: number, to?: number, role: string }[]
}
\`\`\`

A transfer can change company capability without instantly moving physical inventory.

---

# 34. Equipment purchases as discrete strategic events

Use Sonido provides a rare sourceable exact purchase.

In 2014 Meyer Sound documented:
- **20 LYON** line-array loudspeakers;
- **6 × 1100-LFC**;
- **6 × UPA-1P** front fills;
- Galileo Callisto processing;
- **Oscar Marchena**, technical director;
- **Eusebio Marchena**, managing director;
- system bought after a Meyer demo in Amsterdam;
- deployed on **Sergio Dalma**, then planned for **Manuel Carrasco**.

Sources:
- https://meyersound.com/news/use-sonido/
- https://meyersound.es/noticias/directo/giras/use-sonido-estrena-en-espana-su-nuevo-sistema-meyer-sound-lyon-en-la-gira-de-sergio-dalma/

The game can eventually treat major fleet purchases as named strategic moments:
- affects debt/cash;
- opens rider tiers;
- improves supplier relationship;
- creates concentration risk;
- produces trade-press news;
- influences which artists/promoters consider the company.

This is more historically legible than silently increasing a rival's abstract \`kit.audio\` number every few months.

---

# 35. New roster additions after the regional pass

### Strongly supported candidates
- **Megafer**, Ferrol — sound 1980; family succession 1995; later lighting/AV/logistics.
- **Arcoiris Lighting Systems**, Barcelona — lighting 1983; Toni Juncosa.
- **Swing Electroshow**, Valladolid — active/founded 1985–87 range; sound/light/stage.
- **Real Audio Systems**, Valladolid — documented in touring directory; José Luis Rico → Andrés Rico succession; closed 2018.
- **Ingunza Audiovisual**, Bilbao — documented in 2008 touring guide and later Bilbao public concert procurement.

### Useful but source year still weak
- Alacrán Producciones, Valladolid — documented in 2008 touring guide, MD José Luis García.
- Audiomic Producciones — later Bilbao municipal supplier; historical origin still needs work.
- Tecstar / GSI Vitoria — modern Basque suppliers but founding chronology requires stronger evidence.

These should remain in the **actor pool** until chronology confidence improves.

---

# 36. Revised implementation priority

The research now changes the recommended Phase 1 slightly.

### Phase 1A: stop ahistorical foreign local presence
Highest-value minimal correction:
- split global touring availability from local operating presence;
- no permanent \`'*'\` warehouse just because a firm exists globally;
- specific tour can bring a foreign supplier.

### Phase 1B: business-line specialization
Before adding dozens of companies:
- audio;
- lighting;
- video;
- staging/structures;
- rigging;
- backline;
- corporate AV;
- installation;
- distribution.

A rival owns only relevant departments.

### Phase 1C: historical actor pools by region
- fixed major actors;
- deterministic regional actor sampling;
- era-aware active ranges;
- historical names/leadership only where sourced.

### Phase 1D: partner/subhire relationships
Fluge's own history supplies the historical justification.
- specialists can assemble integrated bids;
- repeated partnerships;
- outsourcing vs internalization decision.

### Phase 1E: ownership and succession
- family/internal succession: Megafer, Real Audio Systems, Use Sonido;
- acquisition: Gamerco/Live Nation, PRG/EML, The Project/Warner;
- strategy pivot: Soinua;
- voluntary closure: Real Audio Systems;
- insolvency remains another, separate path.

This sequence will give much more historical behavior than merely changing \`enters\` years.


---

# 37. Deep pass v0.4: foreign technical presence is now pinned earlier than PRG

The earlier research correctly identified **2011** as the PRG acquisition/consolidation point, but the deeper registry and trade-directory pass moves the first clearly documented permanent foreign-linked technical operation earlier.

## EML Sound and Light Productions Spain — 2006

**New evidence**
- Spanish corporate databases list **EML Sound and Light Productions S.L. / later Production Resource Group S.L. as constituted 1 January 2006** in Madrid.
- A **2008 international touring directory** lists **EML Productions Spain**, Madrid, as a Sound, Lighting & Stage Services company, with **Jan Van Malder** as MD and **Xavier Thys** as account director.
- A 2008 Belgian business profile of EML states that EML Productions had **wholly owned subsidiaries in Utrecht and Madrid**.
- The same profile gives the Belgian EML lineage: founded 1979, later ownership changes, management buy-out in 2004, and a large new Tildonk facility in 2008.
- Spanish BORME shows Xavier Theys receiving powers in the Spanish company in 2010.
- PRG then acquired First Events/EML in January 2011, and the Spanish operation changed name to PRG in 2012.

Sources:
- https://www.datoscif.es/empresa/production-resource-group-sl
- 2008 International Talent & Touring Guide, World Radio History
- https://www.dvo.be/artikel/20626-eml-productions-nv
- https://www.boe.es/diario_borme/txt.php?id=BORME-A-2010-83-28
- https://www.prnewswire.com/news-releases/production-resource-group-acquires-eml-productions-in-europe-112936894.html
- https://www.boe.es/diario_borme/txt.php?id=BORME-A-2012-105-28

**Revised foreign-entry timeline**

| Era | Foreign technical participation |
|---|---|
| 1970s–2005 | foreign touring suppliers can accompany international acts; no evidence yet for the current game's permanent Clair/LSD/Solotech local warehouses |
| **2006** | EML Sound and Light Productions S.L. provides the strongest currently documented permanent foreign-linked local technical-production foothold |
| **2008** | EML Spain is visibly present in the international touring directory; Belgian parent describes Madrid as a wholly owned subsidiary |
| **2011** | PRG acquires the EML/First Events group, including the Spanish operation |
| **2012** | Spanish operation changes corporate name to Production Resource Group S.L. |

**Design consequence:** "foreign entry" is not a single 2011 switch. The first implementation should support:
- transient visiting foreign suppliers;
- local foreign subsidiary from 2006;
- ownership/acquisition change in 2011;
- branding/name transition in 2012.

This is exactly why ownership, local presence and brand name need separate timelines.

---

# 38. 2008 directory snapshot: direct evidence of market density

The **2008 International Talent & Touring Guide** gives a useful cross-section of Spanish technical-service firms and named managers. It is not a founding-year source, but it is strong evidence that these companies were active and externally visible by 2008.

## Barcelona / Catalonia
Examples listed under Sound, Lighting & Stage Services include:
- **Arcoiris Lighting Systems** — MD **Antonio/Toni Juncosa**, production **J.M. Galeano**.
- **Croma 440** — MD **Arthur Alvarez**.
- **Eikons** — MD **Ricca Galindo**.
- **Euphonic Projects / Sono** — director **Gavan Gonzalez**.
- **Rock and Classics** — MD **José María Papes**.
- **Spotlight** — GM **Héctor Vidal**, Technical Director **Enrique García**.
- **Triple Onda** — MD **Braulio Paz Simón**, Marketing **María Ferrer**.
- **BackLine Import** — MD **Albert Valdrich**, explicitly equipment/instrument rental rather than a generic full-service PA house.

Source:
- 2008 International Talent & Touring Guide, World Radio History.

**Design use:** Barcelona needs several actor categories: lighting, backline, integrated AV, sound/light/stage and promoter/client actors. One "Barcelona rival" is nowhere near enough.

## Madrid
Directory examples include:
- **EML Productions Spain** — MD Jan Van Malder, account director Xavier Thys.
- **Fluge Sonido Profesional** — MD Luis Berlanga, administration José Luis Ochoa.
- **Forum Sonido** — MD José Luis Jiménez, Technical Director Echedey Sans.
- **Evohe Producciones** — MD Carmen Peiró.
- plus multiple promoter/management companies.

Source:
- 2008 International Talent & Touring Guide.

The directory is especially useful because it distinguishes managerial and technical roles instead of giving us only corporate names.

## Valencia
The same guide lists:
- **Donduit/Doudin**, Quart de Poblet — manager **José Antonio Cubells**.
- **Egidio / Producciones Egidio**, l'Alcúdia de Crespins — MD **Julio Egido**.

Source:
- 2008 International Talent & Touring Guide.

These are valuable actor-pool candidates, but founding dates need separate registry/company-history confirmation before encoding them as historical starts.

## Valladolid
Already documented:
- Alacrán Producciones — José Luis García.
- Real Audio Systems — José Luis Rico / Andrés Rico.
- Swing Electroshow — Manuel Rodríguez.

## Vizcaya
- Ingunza Audiovisual — Patxi Ingunza / Julio Pascual.

## Balearics
The guide lists:
- **Ibison**, Ibiza — MD **Narciso Bonet**.
- **Mallorca S.L. / Mallorca Sound** — sound/light/stage.
- **Sound Menorca** — MD **José Luis Bueno**.

Source:
- 2008 International Talent & Touring Guide.

**Design consequence:** island markets require their own active actor pools. A mainland company should not automatically be the cheapest or most available supplier for Ibiza/Mallorca/Menorca work.

---

# 39. Canary Islands: permanent local technical production existed by the late 1980s

## Sonopluss Canarias — Tenerife

**Evidence**
- Company history says Sonopluss Canarias began **at the end of the 1980s** in Tenerife.
- From the outset it designed/mounted **sound and lighting infrastructure for live shows and events**.
- Client classes include artists, production companies, municipalities and businesses.
- Later capability includes sound, lighting, visuals, concerts, festivals, conventions, fairs, theatre, dance and TV/live recordings.

Source:
- https://www.sonoplusscanarias.es/empresa.php

This precedes Audioluz Canarias (1997) and closes one of the previous research gaps.

**Gameplay**
- Canaries should have a local sound/light actor from roughly 1988–90.
- Later Audioluz adds another regional AV actor.
- mainland freight is a strategic choice, not the default.
- island actor availability should vary by island; inter-island ferry/freight is non-trivial.

---

# 40. Spanish manufacturers and distributors are a historical system, not catalogue flavour

The deeper pass confirms a substantial domestic technology layer that predates much of the rental market.

## Musicson — Valencia

**Evidence**
- Origin **1958** as JOBESONIK, founded by **Joaquín Benavent Pérez**.
- Became MUSICSON in **1965**.
- Family lineage continued through **Joaquín Benavent Díaz**.
- 2026 acquisition by Equipson documents a striking industrial loop: Equipson founders **José Luis Vila and Remedios Martínez** had earlier worked at Musicson; Vila spent 17 years there and became commercial director, while Martínez led imports.

Sources:
- https://musicson.com/quienes-somos/
- https://outside.equipson.es/noticias/musicson-pasa-a-formar-parte-equipson-group
- https://www.afial.net/equipson-group-anuncia-la-adquisicion-de-musicson-la-marca-de-altavoces-y-soluciones-de-audio-profesional-mas-longeva-de-espana/

**Design:** manufacturer staff can create later manufacturers/distributors and eventually acquire the predecessor brand. Industrial lineage can be cyclic rather than a simple family tree.

## Ecler — Barcelona

**Evidence**
- Founded in Spain/Barcelona in **1965**.
- Long-running professional-audio manufacturer focused on electronics, mixing and installation.

Source:
- https://www.ecler.com/es/posts/ecler-to-enhance-chromasound-proav-solutions/

**Design:** domestic mixer/amplifier/install availability precedes modern international distribution networks.

## Beyma — Valencia

**Evidence**
- Family company founded **1969** to manufacture professional loudspeakers.
- First Musikmesse appearance **1974**; internationalization documented thereafter.
- Family moved from Barcelona to Valencia before starting the company.

Sources:
- https://www.beyma.com/historia/
- https://www.beyma.com/50-aniversario/

**Design:** domestic driver/component availability supports local/self-built systems and repair/manufacture strategies in the 1970s–90s.

## DAS Audio — Valencia

**Evidence**
- Origin story begins with Juan Alberola building a sound system around **1970**; official foundation **1971** in Valencia.
- Later becomes an international manufacturer.

Sources:
- https://www.dasaudio.com/sobre-das/
- https://www.dasaudio.com/actualidad/55-aniversario-das-audio/

**Design:** Spanish firms can access a growing domestic complete-system manufacturer rather than only imported products.

## Stonex — Madrid / scenic lighting and engineering

**Evidence**
- **Domingo Latorre founded Stonex in 1980** as a professional-lighting manufacturer.
- **1991:** begins representing leading European brands.
- **1998:** expands deeply into scenic engineering.
- **2007:** group exceeds 100 people.
- **2012:** **Javier Latorre Marrón** takes leadership after the crisis.
- BOE procurement records show Stonex winning large Spanish theatre/scenic-equipment contracts in 1996–97.

Sources:
- https://www.stonexsl.com/2025/06/03/blog/celebramos-45-anos-de-historia-asi-fue-el-aniversario-de-stonex
- https://www.boe.es/diario_boe/txt.php?id=BOE-B-1996-24712
- https://www.boe.es/diario_boe/txt.php?id=BOE-B-1997-12855

**Design:** lighting technology/distribution/scenic engineering is a separate market actor class from rental lighting companies.

## Magnetron — professional distribution

**Evidence**
- Company chronology begins **1973**.
- Professional radio/broadcast roots around Revox.
- **1984:** starts developing Sennheiser in Spain and later collaborates with brands/partners including Yamaha, Meyer Sound, Siluj, Ibercommtec and Kinson.
- Later adds Neumann and PA product lines.

Source:
- https://www.magnetron-cloud.es/magnetron50/

**Design:** manufacturer/distributor links alter availability of microphones, RF and specialist technology independently of PA-rental company ownership.

## Earpro / EES — value-added distribution

**Evidence**
- Current company states **37+ years** of experience; secondary trade reporting places foundation in **1987**.
- Distribution spans professional audio, lighting/rigging, visual and UC.
- Long-term Shure distribution is documented.

Sources:
- https://b2bdev.midwich.es/content/38-sobre-nosotros
- https://taipricebook.es/la-firma-de-audio-profesional-shure-entra-en-el-mercado-de-consumo/

Use **1987 with B-level confidence** until a stronger primary corporate chronology is recovered.

## Equipson — Valencia

**Evidence**
- Founded **1995** by **José Luis Vila**; later WORK/WORK PRO.
- Vila publicly states he had previously spent 16–17 years as commercial director in a major sound company; the 2026 Musicson acquisition identifies that company as Musicson and identifies Remedios Martínez's import role.

Sources:
- https://www.isp-audio.com/directorio-empresas/entrevistas/3777-equipson-work-pro-juan-jose-vila
- https://www.testimoniosparalahistoria.com/entrevista/jose-luis-vila-ortiz-workequipson/
- https://outside.equipson.es/noticias/musicson-pasa-a-formar-parte-equipson-group

**Design:** another documented staff/spin-off network: Musicson → Equipson → later Musicson acquisition.

---

# 41. Expo '92 and the theatre-building era created an engineering/integration boom

Chemtrol's own history describes its entry into scenic engineering through international agreements and projects tied to:
- Teatro Central Hispano;
- Teatro de la Maestranza;
- Expo '92;
- early Kursaal / theatre studies.

After Expo '92 it created a dedicated scenic/audiovisual equipment division and later worked on major Spanish theatres and cultural infrastructure.

Source:
- https://chemtrolstage.com/quienes-somos/

BOE awards from 1995–97 document **Stonex, Chemtrol, Técnicos de Iluminación e Ingeniería Escénica, Strong/Fresnel and others** winning large theatre-equipment packages.

Sources:
- https://www.boe.es/buscar/doc.php?id=BOE-B-1996-19097
- https://www.boe.es/diario_boe/txt.php?id=BOE-B-1996-24712
- https://www.boe.es/diario_boe/txt.php?id=BOE-B-1997-12855

**Simulation implication**
The 1992 boom should not only produce more gigs. It can also create:
- installation/integration demand;
- supplier/distributor expansion;
- technical training and engineering capacity;
- permanent new venue infrastructure;
- reduced rental demand for some installed-house equipment later;
- improved technical standards and local skills.

That is a much more interesting long tail than a one-year demand multiplier.

---

# 42. Market actors need roles: a 2008 directory exposes the taxonomy problem

The touring directory sometimes labels promoters/managers and rental firms under broad service categories. We must not ingest directory categories literally.

Examples:
- Gay & Co. / Gamerco is fundamentally a promoter/client actor.
- BackLine Import is equipment/instrument rental.
- Arcoiris is lighting.
- EML/Fluge are technical production.
- Chapman Freeborn is cargo/charter logistics.
- Sono/Euphonic Projects is AV/integration.
- Stonex/Chemtrol are scenic engineering/distribution/integration.

**Architectural conclusion:** historical data requires a typed actor graph.

Suggested top-level actor roles:
- \`technical-rental\`
- \`staging-rigging\`
- \`backline\`
- \`av-integrator\`
- \`manufacturer\`
- \`distributor\`
- \`promoter\`
- \`venue\`
- \`logistics\`
- \`freelance-technical\`

A legal company may hold more than one role across different eras.

---

# 43. Research conclusion of the second deep pass

The Spain model is no longer mainly about correcting dates.

The evidence supports an **industrial network simulation**:
- companies specialize and partner;
- technical people migrate;
- manufacturers and distributors shape feasible equipment choices;
- promoters create tour demand and may be acquired independently;
- local subsidiaries appear at specific dates;
- ownership and name changes preserve operations;
- regional markets contain several small/medium competitors;
- major public infrastructure projects can permanently reshape supplier capability;
- island logistics create durable local moats;
- company strategies change by era rather than by immutable personality.

The 2006 EML correction also demonstrates the value of keeping confidence/source metadata in the content layer: a deeper source can revise chronology without rewriting runtime mechanics.
