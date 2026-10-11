# Rival companies: the history behind them

The rival rental houses in `src/world/content/companies.ts` are real firms. This file records where each date, base, takeover and leader comes from, and how sure we are.

**Confidence:** **C** confirmed by a primary or trade source, **L** likely (one source, or sources disagree slightly), **U** uncertain or not found.

**What the game models.** Since PR #24 the firms are content in `src/world/content/actors/` (presence, name and operating eras, company events), with documented people in `content/people.ts` and game-tuning strategy eras in `src/world/strategies.ts`. The architecture is in docs/research/historical-market-architecture.md, and the Spanish research is in docs/research/spain-live-production-market.md.

A firm is on the map from the year it had a *local base* in that country. A foreign house that only came with its acts' tours never gets a warehouse. A strategy (how a firm plays) belongs to a company and an era, together with the documented behaviour it is read from. It is never a judgement of a person.

## Strategies (game tuning)

| Strategy | Drawn from | In play (`strategies.ts`) |
|---|---|---|
| Pioneer | Engineer-founders who built their own systems or were first with a new technology | Reinvests early, aims above the era's kit, stretches further to meet a rider, grows a tier more readily, rarely starts price wars |
| Perfectionist | "Only as good as the last show"; firms run on service and artist relationships | Pickier about offers, never short on a rider, very rarely fights on price, holds few grudges |
| Expansionist | New offices, new countries, buying their way in | Chases more work, reinvests sooner, starts more price wars, buys more firms, grows fastest |
| Consolidator | Firms that grew by acquisition | First in line to buy a struggling rival |
| Prudent | Family firms and independents that grew organically | Keeps 4½ months of overhead in the bank before spending, takes slightly less work, avoids fights |
| Hustler | Volume and price (NicLen's dry hire; some start-ups) | Cheap and everywhere: takes the most work, spends least on riders, starts most price wars, holds grudges |
| Specialist | Firms that stay in one department (Valladar, Tri i Talfis, Cinelux, Efectes) | Never takes on new departments; others subcontract to it |
| Regional | Firms living off their own patch (Megafer, Soinua, Swing) | Rarely goes for work far from home |
| Integrator | Firms that subcontracted first and then brought departments in-house (Fluge, EMSAC) | Most likely to buy into a department it keeps hiring in |

A firm without a strategy era plays "steady", with no nudges. A documented change of leadership makes the news, but it doesn't change how the firm plays.

## International houses: when they set up in each country

| Firm | US | Britain | Spain | Germany | France / Italy |
|---|---|---|---|---|---|
| Clair Brothers → ClairShowco (2000) → Clair Global (2008) | 1966 (C) | 2008, buying Concert Sound (C) | none found | through Black Box Music, 2022: that firm carries on as BBM \| Clair (C) | none found |
| Harris Production Services (1983) → PRG (1995) | 1983 (C) | through Light & Sound Design, PRG from 1998 (C) | through EML Spain: Madrid 2006, bought into PRG 2011, renamed 2012 (A) | through Procon: bought 2009, PRG from 2010 (C) | none found |
| Solotech (Montreal, 1977) | 2007, Las Vegas office (C) | through SSE Audio Group: bought 2018, Solotech UK from 2020 (C) | none found | not modelled | not modelled |

Acquisitions are continuity events. The bought firm keeps its base, kit, crew and clients, and only its owner and later its name change.

**Spain.** No big American house set up in Spain. The first permanent foreign-linked technical company is EML Sound and Light Productions SL, constituted in Madrid in 2006 as a subsidiary of Belgium's EML. PRG bought EML's parent in January 2011, and the Spanish company took the PRG name in 2012 (A, PR #24 research). Dushow's Barcelona arm, formed in 2004 and trading from 2005, is the other early foreign group (B). Before that, foreign participation came in other layers: tours bringing their own suppliers, Euphon's 60% of Sono around 2001, and Live Nation buying Gamerco in 2006.

Corrections to the first research pass: EML's Spanish company dates from 2006, not 1998. CT's Spanish structure is from 2021, not 2007, so CT has no Spanish base in the game.

## Britain

| Firm | Founded | Base | Events | Leaders (style) | Conf. |
|---|---|---|---|---|---|
| Britannia Row | 1975 | Islington, London | Pink Floyd's rig, hired out between tours. Sold by the band 1984 (Wikipedia says 1985). Clair Global bought it in 2017. Bought Skan in 2022 | Robbie Williams 1975–83 (pioneer); Bryan Grant and Robbie Williams 1984–90; Bryan Grant and Mike Lowe 1991–2016 (perfectionist: "you're only as good as your last show"); then Clair | C (1984/85 U) |
| Light & Sound Design | 1975 | Birmingham | Salvesen 1991; management buyback 1995; joined PRG 1998 | Nick Jackson (pioneer: the Icon moving light); then Jere Harris (dealmaker) | C/L |
| SSE Audio | 1976 | Nottingham (Trent Poly), then Birmingham 1984 and Redditch 2003 | Bought Canegreen 2008, Wigwam 2013 and Capital 2018. Sold to Solotech in 2018 | John Penn 1976–2019 (dealmaker) | C |
| Wigwam Acoustics | c. 1978 | Heywood, near Rochdale | Bought by SSE in 2013 | Mick Spratt, Chris Hill | year U |
| Neg Earth Lights | 1983 | London (Park Royal) | Still independent and family-run | Dave and Pip Ridgway (prudent) | C |
| Adlib | 1984 | Liverpool | Management buyout in 2024 | Andy Dockerty 1984–2023 (prudent) | C |
| Creative Technology | 1986 | London (Crawley) | Avesco group; NEP bought Avesco in 2017 | Dave Crump (pioneer) | L |
| Delta Sound → DeltaLive | 1988 | Weybridge | L-Acoustics took a majority stake in 2019. Groupe Novelty bought it in 2026 | Mark Bonner and Paul Keating 1988–2019 (expansionist: corporate shows, then Dubai) | C (rename year U) |
| Capital Sound | 1989 | London | Bought by SSE in 2018 | Keith Davis | C |
| XL Video | 1995 | Belgium, with a UK base | Bought by PRG in 2015 | — | L |
| Martin Audio | 1971 | London | Sold to TGI in 1990; from then on it only builds loudspeakers | Dave Martin (perfectionist: a brilliant horn designer, "no businessman") | C (its hire work U) |
| Skan PA Hire | 1970s | Newbury | Bought by Britannia Row in 2022 | Peter Howard; Chris Fitch and Abby Llewellyn from 1996 (perfectionist) | L |
| 22live | 2022 | Redditch | Six ex-SSE directors | Spencer Beard (expansionist) | C |

Removed: "ESS PA". No firm of that name could be found.

Sources:
- https://news.pollstar.com/2025/07/29/unwavering-commitment-to-staff-crew-clients-a-synopsis-of-britannia-row-productions-50-year-history/
- https://www.livedesignonline.com/light-sound-design-joins-prg
- https://www.tpimagazine.com/john-penn-retires-from-sse-audio/
- https://lsionline.co.uk/news/sse-audio-group-acquires-wigwam-acoustics-mks03y
- https://negearth.co.uk/about-us/
- https://www.adlib.co.uk/insights/adlib-announces-management-buyout
- https://martin-audio.com/downloads/edge/MartinAudio_TheEdge_40yrs.pdf
- https://www.mixonline.com/live-sound/l-acoustics-acquires-deltalive
- https://deltalive.com/news/delta-live-joins-groupe-novelty/
- https://www.gimv.com/en/news/gimv-portfolio-company-xl-video-acquired-prg
- https://lsionline.co.uk/news/britannia-row-productions-acquires-skan
- https://www.mixonline.com/business/new-uk-live-sound-provider-22live-debuts

## United States

| Firm | Founded | Base | Events | Leaders (style) | Conf. |
|---|---|---|---|---|---|
| Bandit Lites | 1968 | Kingsport TN, then Knoxville 1973 and Nashville 1982 | — | Michael Strickland (pioneer: early LED rigs); Peter Heffernan from 2008 (prudent) | C |
| Tycobrahe Sound | late 1960s | Hermosa Beach CA | Built the California Jam PA (1974); later went out of business | Bob Bogdanovich (pioneer) | closing year U |
| Showco | 1970 | Dallas | Vari-Lite spun out in 1981; sold to Clair in 2000 | Jack Calmes 1970–80 (perfectionist); Rusty Brutsché (pioneer) | C |
| Silverfish → Sound Image | 1971 | Rochester NY, then San Diego area | Renamed 1981 or 1984 | Ross Ritto and Joel Silverman; Dave Shadoan from about 1981 (perfectionist) | rename U |
| Upstaging | 1972 | Des Plaines IL | — | Robert and Don Carone (prudent) | C |
| Thunder Audio | c. 1978 | Detroit area (Willis, then Livonia) | — | Tony Villarreal (prudent) | L |
| Eighth Day Sound | c. 1980 | Highland Heights, OH | Bought by Clair in 2020 | — | L |
| Harris / PRG | 1983 | New York | See above | Jere Harris 1983–2021 (dealmaker) | C |
| Firehouse Productions | 1994 | Red Hook NY | — | Bryan Olson (perfectionist) | year L |
| Christie Lites | 1985 (Toronto) | US from 1998 | — | Huntly Christie (expansionist: identical kit at every branch) | C |

Sources:
- https://www.prosoundweb.com/history-files-tycobrahe-sound-company-and-the-california-jam/
- https://namm.org/library/oral-history/dave-shadoan
- https://en.wikipedia.org/wiki/Showco
- https://lsionline.co.uk/news/vari-lite-sells-showco-to-clair-bros-7ff3es
- https://digital.livesoundint.com/mar-2013/page-16
- https://www.prosoundweb.com/clair-global-announces-acquisition-of-eighth-day-sound/
- https://our.tennessee.edu/2011/bright-lights-big-business/
- https://plsn.com/?p=360635
- https://fohonline.com/?p=96675
- https://plsn.com/articles/ld-at-large/huntlys-way

## Spain

Full sources and confidence are in docs/research/spain-live-production-market.md. This is what the game uses.

**Always in the roster:**

| Firm | Base (map town) | Lines | From | Notes |
|---|---|---|---|---|
| Milán Acústica | Madrid | sound, later installation | 1976 (firm's own date; SA 1981) | |
| Escenarios Valladar | Madrid | staging, rigging | 1980 | |
| LIL Service → Twin Cam Audio | Barcelona | sound | 1979 lineage (C); Twin Cam companies 1990 (A) | Rafael Campos MD (documented 1994) |
| Arcoiris Lighting Systems | Barcelona | lighting, later sound | 1983 | Toni Juncosa |
| Pronorte | Gijón | sound, lighting | 1985 | José Javier García "Boby" |
| Berenice Concert Systems | Madrid | sound | SA 1986; last accounts 1995 | exact operating end not established; no scripted closure |
| Sorter | Madrid | sound | SA 1986 | |
| Fluge Audiovisuales | Madrid | sound in 1990; lighting and video later | 1990 | Luis Berlanga; used outside lighting firms at first |
| EML Productions Spain → PRG | Madrid | sound, lighting, video | 2006 | PRG ownership 2011, name 2012 |

**Regional pools** (each game draws some, by map seed):

| Region | Firms |
|---|---|
| Central | Espiral (live hire from the early 1980s), Tri i Talfis (1995), Cinelux (1988) |
| Catalonia | Sono (corporate AV, 1972; Euphon 60% around 2001), Dushow Barcelona (2005) |
| Andalucía | Apogee Servicios (1993), Sonorock (by 1992), TCM Audiovisión (by 1994), Audiovisual Ojeda (1992), Sonido Tole (by 2007) |
| Galicia | EMSAC (1993), Megafer (1980; family succession 1995) |
| Castilla y León | Use Sonido (about 1993), Swing Electroshow (1985–87), Real Audio Systems (by 2008; wound up 2018) |
| Basque Country | Soinua (1990; turns to distribution 2015), Ingunza Audiovisual (by 2008) |
| Balearics | Efectes (lighting, 1981), Balear Acustic (1990) |

Removed after research: Stonex, a stage-machinery engineer that belongs in the supplier layer rather than among the rental rivals. Firms that are documented but too thin to give stats are not in the game yet, such as Daniel Sonido, Alacrán and the Valencian firms.

## France

| Firm | Founded | Base | Events | Leaders (style) | Conf. |
|---|---|---|---|---|---|
| MES Eclairages | 1981 | Nantes | Bought by Melpomen in 2013 | — | C |
| Dushow | c. 1982 | Roissy (Paris) | Joined Novelty and Magnum in 2018 | Eric Alvergnat | L |
| Novelty | early 1980s | Paris | Founded as Euphonie, then Euroson. Holding with Magnum 2016; Dushow 2018 | Jacques de La Guillonnière (dealmaker: about 70 firms bought) | year U |
| Melpomen | ? | Nantes | Part of SSE Audio Group 2001–2017, then bought back by its managers | Thierry Tranchant (perfectionist: Royal de Luxe) | year U |

Sources:
- https://en.soundlightup.com/news/novelty-france-magnum-dushow-group-new-european-leader.html
- https://lsionline.co.uk/news/french-lighting-company-acquired-by-sse-q4fohp
- https://fast-and-wide.com/faw-news/fast-news/9730-sse-audio-sells-melpomen-to-b-live-group
- https://www.lightzoomlumiere.fr/livre/mondo-dr-35-3-interview-de-jacques-de-la-guillonniere-groupe-novelty/

## Germany

| Firm | Founded | Base | Events | Leaders (style) | Conf. |
|---|---|---|---|---|---|
| Lightpower | 1978 (as Proppe & Hövelkröger; Lightpower 1987) | Paderborn (Dortmund on the map) | Rental house for touring acts, later a distributor | Ralph-Jörg Wezorke | C |
| Gahrens + Battermann | 1983/84 | Bergisch Gladbach (Köln on the map) | Video, then full service; its own academy | Kurt-Werner Gahrens, Jürgen Battermann | C |
| Procon | 1988 | Hamburg | Computer-controlled lighting; listed 1999; PRG 2009, PRG name 2010 | Morten Carlsson | C |
| Amptown System Company | 1990 | Hamburg | Musicals (CATS), theatres, cruise ships; insolvency filing 2022 (outcome not found) | Peter Matthes, Ulrich Müller | C |
| Neumann&Müller | 1981 | Düsseldorf (not Dresden) | Outdoor PA for WDR radio; more than 20 branches | Jürgen Neumann and Eberhard Müller (prudent) | C |
| Black Box Music | ? | Berlin | To Clair Global in 2022 as BBM \| Clair | Thilo Goos (perfectionist: one campus for a whole tour) | year U |
| NicLen | 1992 | Dortmund | Dry hire; Invision took a stake in 2018 | — | L |
| satis&fy | 1993 | Karben, near Frankfurt | — | — | C |
| Feedback Show Systems | c. 1996 | Alsdorf, near Aachen | First in Germany with Turbosound Flashline | Bernd Schmitz (pioneer) | L |
| Crystal Sound | ? | Karlsruhe | — | — | year U |

Sources:
- https://www.neumannmueller.com/en/about-us/history/
- https://clairglobal.com/press-articles/black-box-clair-global-network
- https://realdeals.eu.com/article/invision-backs-family-dry-hire-events-business-niclen
- https://archiv.location-award.de/fileadmin/redakteure/dokumente/presse/2012/satisfy_Unternehmensportrait.pdf
- https://lsionline.com/news/feedback-takes-first-flashline--z4ujow

## Italy

The Italian trade press names a tour's suppliers but rarely gives company histories, so many years here are when a firm first appears.

| Firm | Founded | Base | Notes | Leaders (style) | Conf. |
|---|---|---|---|---|---|
| STS Communication | 1984 | Bresso (Milan) | Congress kit, then trade shows, TV and concerts; LED for Ligabue and Pausini; PRG Alliance member | Alberto Azzola (MD, start not found) | C |
| Mixer Sound & Light | 1986 | Romanengo, near Cremona (Brescia on the map) | Among the first in Italy with moving lights (Telescan); mostly TV | Walter Taietti (pioneer; start year U) | C |
| Xenon | c. 1986 | not found | Festivalbar "for the 19th year running" in 2004 | Renato Neri | L |
| Agorà | c. 1990 | L'Aquila (Pescara on the map) | Bocelli, Pausini, Ligabue, Jovanotti; Olympic ceremonies | Wolfango and Vittorio De Amicis (expansionist) | L |
| Limelite | ? | Rome | Lighting on Vasco Rossi tours (2004, 2011) | — | year U |
| Euphon Communication → Mediacontech (2007) | 2003 (as a group company) | Turin | Screens for Vasco Rossi 2004; held 51% of Deltatre | Enzo Badalotti (dealmaker, CEO in 2007) | C |
| Nuovo Service | by 2005 | Bologna | Full production for Vasco Rossi, Live Kom 011 | Willy Gubellini | first seen 2005 |
| BOTW | by 2018 | Rome (Pomezia) | Vasco Rossi's lighting and set builder, 2018–2024 | — | first seen 2018 |

No Italian base was found for Clair, PRG (which works there through STS and the PRG Alliance), Solotech or Britannia Row. NEP bought Telerecord in 2018, but that is broadcast and isn't modelled.

Removed: "Mastervoice". No rental firm of that name could be found.

Sources:
- https://www.prosoundweb.com/italys-agora-adds-ssl-live-to-console-portfolio/
- https://www.lsionline.co.uk/news/robe-ledwashes-on-vasco-rossi-tour--rlg3jj
- https://www.prg.com/alliance/members/sts
- https://old.lsionline.com/news/robe-in-the-mix--p8650l
- https://old.lsionline.com/news/clay-paky-at-festivalbar-2004-4e0vi3
- https://lsionline.com/news/led-screens-illuminate-vasco-rossi-tour-i5vigq
- https://www.milanofinanza.it/news/euphon-cambia-nome-e-diventa-mediacontech-1303519
- https://www.prosoundweb.com/rcf-tt-tours-with-italian-singer-vasco-rossi/
- https://old.lsionline.com/news/robe-is-non-stop-live-with-vasco-rossi
