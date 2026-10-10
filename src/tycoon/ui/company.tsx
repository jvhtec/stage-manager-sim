import { useEffect, useMemo, useState } from 'react';
import { borrow, buyRival, goPublic, headhunt, investigate, repay, setDividend, takePrivate } from '@/world/actions';
import { brandOf } from '@/world/sponsors';
import { owed } from '@/world/receivables';
import { expertise, knownForLabel } from '@/world/expertise';
import { DEPT_COLORS, DEPT_LABELS } from '@/world/catalog';
import { DEPTS } from '@/world/types';
import { HEAT_DIRTY, INTEL_DAYS, aggression, hasIntel, heatOf, investigatorBlocker, investigatorCost } from '@/world/rivalry';
import { headhuntBlocker, headhuntFee, headhuntTarget } from '@/world/headhunt';
import { levelOf, roleOf } from '@/world/people';
import { DIVIDENDS, IPO_FLOAT, buybackCost, ipoProceeds, listingBlocker, marketCap, sharePrice } from '@/world/shares';
import type { DividendLevel } from '@/world/types';
import { rivalHealth, takeoverBlocker, takeoverPrice } from '@/world/rivals';
import {
  START_YEARS,
  NEGATIVE_MONTHS_GAME_OVER,
  TIERS,
  companyTier,
  tierInfo,
} from '@/world/catalog';
import { formatDay, formatHour, yearOf } from '@/world/core';
import { MILESTONES } from '@/world/milestones';
import { forecastCash } from '@/world/cashflow';
import { chainText, incidentsOf } from '@/world/consequences';
import { SCENARIOS, getScenario } from '@/world/scenarios';
import { DIFFICULTIES, DIFFICULTY_IDS, GOALS, GOAL_IDS, goalDeadlineYear, legacyScore } from '@/world/scenario';
import { worldOf } from '@/world/mapgen';
import { companyValue } from '@/world/queries';
import { awardsName, companyRating, rivalRating } from '@/world/awards';
import { describeLoanRate } from '@/world/market';
import { borrowStep, creditLimit } from '@/world/finance';
import { suggestedHqCities } from '@/world/state';
import { LEDGER_LABELS, type AnnualReport, type Difficulty, type GoalId, type LedgerCategory, type TycoonState } from '@/world/types';
import { createRandomSeed } from '@/lib/rng';
import { COUNTRIES, type CountryCode } from '@/world/content/countries';

/** Default the picker to the player's browser locale when we support it. */
function guessCountry(): CountryCode {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en-GB').toUpperCase();
  const region = lang.split('-')[1] ?? lang.split('-')[0];
  const byLang: Record<string, CountryCode> = { ES: 'ES', GB: 'GB', US: 'US', DE: 'DE', FR: 'FR', IT: 'IT', EN: 'GB' };
  return byLang[region] ?? 'GB';
}
import { Bar, Stat } from './bits';
import { BrandBadge } from './brands';
import { formatPopulation, kmoney, money } from './format';
import type { WinCtx } from './types';

export function FinanceWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const year = yearOf(state, state.hour);
  const years = [year - 2, year - 1, year].filter(y => y >= state.startYear);
  const cats = Object.keys(LEDGER_LABELS) as LedgerCategory[];
  const tier = companyTier(state.company.reputation);
  const next = TIERS.find(t => t.tier === tier + 1);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };

  return (
    <div>
      <table className="tt-table">
        <thead>
          <tr>
            <th />
            {years.map(y => (
              <th key={y}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map(c => (
            <tr key={c}>
              <td className="tt-dim">{LEDGER_LABELS[c]}</td>
              {years.map(y => {
                const v = state.ledger[y]?.[c] ?? 0;
                return (
                  <td key={y} className={v > 0 ? 'tt-good' : v < 0 ? 'tt-bad' : 'tt-dim'}>
                    {v ? money(v) : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            {years.map(y => {
              const v = Object.values(state.ledger[y] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
              return (
                <td key={y} className={v >= 0 ? 'tt-good' : 'tt-bad'}>
                  {money(v)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <h4>Balance sheet</h4>
      <Stat label="Cash">
        <b className={state.company.cash < 0 ? 'tt-bad' : ''}>{money(state.company.cash)}</b>
      </Stat>
      <Stat label="Loan">
        {money(state.company.loan)} <span className="tt-dim">/ {money(creditLimit(state))} @ {describeLoanRate(state)}</span>
      </Stat>
      <Stat label="Company value">{money(companyValue(state))}</Stat>
      {state.receivables.length > 0 && (
        <>
          <Stat label="Owed to you">
            <b>{money(owed(state))}</b> <span className="tt-dim">· {state.receivables.length} invoice{state.receivables.length === 1 ? '' : 's'}</span>
          </Stat>
          <div className="tt-dim" style={{ whiteSpace: 'normal', fontSize: 11 }}>
            {[...state.receivables]
              .sort((a, b) => a.dueDay - b.dueDay)
              .slice(0, 4)
              .map(i => `${i.act} ${money(i.amount)} (${formatDay(state, i.dueDay)}${i.insured ? ', insured' : ''})`)
              .join(' · ')}
          </div>
        </>
      )}
      <CashForecast state={state} />
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button className="tt-btn sm" disabled={state.company.loan >= creditLimit(state)} onClick={() => act(borrow)}>
          Borrow {money(Math.min(borrowStep(state), Math.max(0, creditLimit(state) - state.company.loan)))}
        </button>
        <button className="tt-btn sm" disabled={state.company.loan <= 0} onClick={() => act(repay)}>
          Repay {money(Math.min(borrowStep(state), state.company.loan))}
        </button>
      </div>
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        The bank lends against what you own and how well you're run (your company rating).
        {state.vehicles.some(v => v.owner === 'player' && v.lease)
          ? ` Leases: ${money(state.vehicles.reduce((sum, v) => sum + (v.owner === 'player' && v.lease ? v.lease.monthly : 0), 0))}/month.`
          : ''}
      </div>
      {state.negativeMonths > 0 && (
        <div className="tt-bad" style={{ marginTop: 6 }}>
          {state.negativeMonths} month{state.negativeMonths > 1 ? 's' : ''} closed in the red —{' '}
          {NEGATIVE_MONTHS_GAME_OVER - state.negativeMonths} more and the bank shuts you down.
        </div>
      )}
      <h4>Shareholders</h4>
      {state.listing ? (
        <>
          <Stat label="Share price">
            <b>{money(Math.round(sharePrice(state)))}</b> <span className="tt-dim">· market cap {money(marketCap(state))}</span>
          </Stat>
          <Stat label="Confidence">
            <span className={state.listing.confidence < 30 ? 'tt-bad' : state.listing.confidence > 65 ? 'tt-good' : ''}>{Math.round(state.listing.confidence)}</span>
            <span className="tt-dim"> · paid out {money(state.listing.paid)} so far</span>
          </Stat>
          <Bar value={state.listing.confidence} max={100} color={state.listing.confidence < 30 ? '#ef4444' : '#22c55e'} />
          <div className="tt-dim" style={{ margin: '6px 0 2px' }}>Dividend policy</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(Object.keys(DIVIDENDS) as DividendLevel[]).map(id => (
              <button key={id} className="tt-btn sm" data-on={state.listing!.dividend === id} onClick={() => act(s => setDividend(s, id))}>
                {state.listing!.dividend === id ? '● ' : '○ '}
                {DIVIDENDS[id].label}
              </button>
            ))}
          </div>
          <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
            {DIVIDENDS[state.listing.dividend].blurb} A losing month costs you the market's trust; at zero for long enough, the board
            ousts you.
          </div>
          <button className="tt-btn sm" style={{ marginTop: 6 }} disabled={state.company.cash < buybackCost(state)} onClick={() => act(takePrivate)}>
            Go private again · {money(buybackCost(state))}
          </button>
        </>
      ) : (
        <>
          <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
            Float {Math.round(IPO_FLOAT * 100)}% of the company for about {money(ipoProceeds(state))} — then answer to shareholders.
          </div>
          {listingBlocker(state) && <div className="tt-warn" style={{ marginTop: 4 }}>{listingBlocker(state)}</div>}
          <button className="tt-btn sm" style={{ marginTop: 6 }} disabled={!!listingBlocker(state)} onClick={() => act(goPublic)}>
            Go public
          </button>
        </>
      )}
      <h4>Sponsors &amp; goodwill</h4>
      {state.sponsors.some(d => d.status === 'active') ? (
        <div className="tt-list">
          {state.sponsors
            .filter(d => d.status === 'active')
            .map(d => (
              <div key={d.id} className="tt-item" style={{ gap: 6 }}>
                <div className="grow" style={{ whiteSpace: 'normal' }}>
                  <b>{brandOf(d.brandId)?.name}</b> <span className="tt-dim">— {money(d.monthly)}/month</span>
                  <div className="tt-dim">
                    {d.minShows}+ shows a month · until {formatDay(state, d.endDay)} · {money(d.paid)} paid
                  </div>
                  {d.shortfalls > 0 && <div className="tt-bad">Missed last month — one more and they walk.</div>}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>No sponsors yet. Brands call once you have a name and some shows behind you.</div>
      )}
      <Stat label="Goodwill">
        <b>{Math.round(state.goodwill ?? 0)}</b> <span className="tt-dim">/ 100 · {state.charityDone ?? 0} charity night{(state.charityDone ?? 0) === 1 ? '' : 's'}</span>
      </Stat>
      <Bar value={state.goodwill ?? 0} max={100} color="#ec4899" />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Good causes cost money now and build goodwill, which brings more sponsor offers at better rates. Goodwill fades slowly.
      </div>
      <h4>Reputation</h4>
      <div className="tt-row">
        <span>
          <b>{Math.round(state.company.reputation)}</b> · {tierInfo(tier).label}
        </span>
        <Bar value={state.company.reputation} max={100} color={tierInfo(tier).color} />
      </div>
      <div className="tt-dim" style={{ marginTop: 4 }}>
        {next
          ? `Reach ${next.minReputation} to book ${next.label} venues. Bigger rooms are what raise reputation past each tier.`
          : 'Top of the industry — every stadium in the land will take your call.'}
      </div>
      <Stat label="Known for">
        <b>{knownForLabel(state)}</b>
      </Stat>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {DEPTS.map(d => (
          <div key={d} title={`${DEPT_LABELS[d]}: ${Math.round(expertise(state, d))}`} style={{ textAlign: 'center' }}>
            <div style={{ height: 34, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${Math.max(6, expertise(state, d))}%`, background: DEPT_COLORS[d], borderRadius: 2 }} />
            </div>
            <div className="tt-dim" style={{ fontSize: 10 }}>{DEPT_LABELS[d]}</div>
          </div>
        ))}
      </div>
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        A moving average of the kind of work you do. Specialists earn up to ~8% more on shows that lean on their speciality and a little less
        outside it; generalists sit in the middle.
      </div>
      <Stat label="Shows played / failed">
        {state.stats.showsPlayed} / <span className={state.stats.showsFailed ? 'tt-bad' : ''}>{state.stats.showsFailed}</span>
      </Stat>
      <h4>Annual reports</h4>
      {state.reports.length ? (
        <table className="tt-table">
          <thead>
            <tr>
              <th />
              {[...state.reports].slice(-3).map(r => (
                <th key={r.year}>{r.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Revenue', (r: AnnualReport) => money(r.revenue), null],
                ['Costs', (r: AnnualReport) => money(r.costs), null],
                ['Net', (r: AnnualReport) => money(r.net), (r: AnnualReport) => (r.net >= 0 ? 'tt-good' : 'tt-bad')],
                ['Company value', (r: AnnualReport) => money(r.value), null],
                ['Shows (failed)', (r: AnnualReport) => `${r.shows} (${r.failed})`, null],
                ['Average show', (r: AnnualReport) => `${Math.round(r.avgQuality * 100)}%`, null],
                ['League rank', (r: AnnualReport) => `${r.rank} of ${r.firms}`, null],
                ['Fleet / crew', (r: AnnualReport) => `${r.fleet} / ${r.crew}`, null],
              ] as [string, (r: AnnualReport) => string, ((r: AnnualReport) => string) | null][]
            ).map(([label, fmt, cls]) => (
              <tr key={label}>
                <td className="tt-dim">{label}</td>
                {[...state.reports].slice(-3).map(r => (
                  <td key={r.year} className={cls ? cls(r) : ''}>
                    {fmt(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
          The first annual report lands on New Year's Day: income, costs, company value and where you rank.
        </div>
      )}
    </div>
  );
}

export function NewsWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const world = worldOf(state);
  return (
    <div className="tt-list">
      {state.news.map(n => {
        const city = n.cityId ? world.cityById.get(n.cityId) : undefined;
        return (
          <div
            key={n.id}
            className={`tt-item ${city || n.vehicleId || n.gigId ? 'clickable' : ''}`}
            onClick={() => {
              if (n.gigId) ctx.open('gig', n.gigId);
              else if (n.vehicleId) ctx.open('vehicle', n.vehicleId);
              else if (city) ctx.goTo(city.x, city.y);
            }}
          >
            <div className="grow">
              <div style={{ whiteSpace: 'normal' }} className={n.tone === 'bad' ? 'tt-bad' : n.tone === 'good' ? 'tt-good' : ''}>
                {n.text}
              </div>
              <div className="tt-dim" style={{ fontSize: 11 }}>
                {formatHour(state, n.hour)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HelpWindow() {
  return (
    <div style={{ maxWidth: 420, whiteSpace: 'normal' }}>
      <p style={{ marginTop: 0 }}>
        You run a touring production company. Shows pop up at venues all over the map — the bigger the town, the bigger the room.
        Your job is logistics: get the right gear and enough crew to each venue <b>before load-in at 10:00</b> on show day.
      </p>
      <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
        <li>
          Click a <b>price tag</b> over a venue (or open <b>Shows</b>) and <b>Book</b> it.
        </li>
        <li>
          <b>Assign</b> one or more vehicles. Trucks load gear and crew from their depot and leave in time to make load-in.
        </li>
        <li>Late trucks, missing gear and short crews all cut the fee. A no-show costs a penalty.</li>
        <li>
          <b>Tours</b> (Shows → Tours) bundle a run of dates with a completion bonus — put a truck on the whole tour and it
          drives the route. <b>World tours</b> add legs abroad: get the rig to the international airport in time and it's
          flown out, plays Madrid, New York or Tokyo, and flies home.
        </li>
        <li>
          Gear is real kit — Martin, Meyer, L-Acoustics, Vari-Lite, MA… Crowds expect better every year, and artists' riders ask
          for brands. Yesterday's flagship becomes tomorrow's pub rig.
        </li>
        <li>
          Real acts tour at the size their career is at. Book a band in a pub, do them proud, and they'll ask for you when
          they're filling arenas.
        </li>
        <li>
          <b>Star techs</b> — real big names (FOH engineers, lighting and show designers, production managers) join in their era.
          Put one on a truck and the shows it plays get better, especially for the acts they're known for.
        </li>
        <li>
          <b>Who'll hire you</b> — venues need a reputation tier, and real acts' management sets its own bar: big names (and acts
          headed for the top) only hire established crews, even for a club date. Start with local bands; do an act proud and
          they'll lower the bar for you next time.
        </li>
        <li>
          <b>The market</b> moves: busy summers, dead Januaries, and real history — recessions, booms, interest rates that swing
          from 0.5% to 17%, even a pandemic. See <b>Market</b>.
        </li>
        <li>
          <b>Festivals</b> (Glastonbury, FIB, Rock am Ring…) tender their stages two months out — multi-day jobs that pay like a
          run of arena dates.
        </li>
        <li>
          <b>House contracts</b>: install a rig in a venue for a year for a monthly retainer; its shows run on your rig and rivals
          can't touch them.
        </li>
        <li>
          <b>Upkeep</b> (Policies): gear wears out and can die mid-set — run a workshop or refurbish. Crews tire on the road and
          quit if underpaid. Insure against theft, crashes and festival storms.
        </li>
        <li>
          <b>Bases</b>: open a <b>delegation</b> (branch office, vans only) or a <b>warehouse</b> in any town and grow it as
          your reputation does. Bases near the work cut fuel, hotel nights and freelance rates — and add rent and salaries.
          Full-time staff (prep, sales) stay at the base; gig technicians go on the road, topped up by local freelancers.
        </li>
        <li>
          <b>Special events</b> (Shows → Events) — Live Aid, Olympic ceremonies, Eurovision, the BRITs… — are tendered
          department by department: put in a sealed bid (sharp, standard or premium). On live TV nothing may be late or fail.
        </li>
        <li>
          <b>The trade</b>: short of kit, sub-hire it from a rival nearby (or rent your idle kit out); courier kit between your
          bases; and when a rival struggles, buy them out from the League.
        </li>
        <li>
          <b>Growing the firm</b>: lease trucks instead of buying them; the bank lends against what you own and your rating. Fund
          <b> R&D</b> to build your own kit (and earn royalties), sign <b>production deals</b> with acts who love you, and train
          your crews.
        </li>
        <li>
          <b>Crew</b> are people: sound, lighting, video and staging techs rated 1–5★, with traits (crew chief, perfectionist,
          road warrior…). Shows want the right specialists — a light-heavy arena needs LX techs — and everyone levels up by
          working. Hire from the market each month. <b>Pin</b> someone to a truck to make them its regular, or open a booked
          show and <b>Choose the crew</b> to name exactly who goes. Set a rest rota in Policies so tired people sit jobs out.
          If morale slips, rivals make offers to your stars — match them within two weeks or lose them.
        </li>
        <li>
          <b>Needs your call</b>: a breakdown with a show waiting, a rig held at customs, undersized power, a union call, an
          injured tech, a star demanding a raise mid-tour… The game pauses and asks. Ignore it and the cheap default happens at the deadline.
        </li>
        <li>
          <b>Planning a truck</b>: select it and its route is drawn on the map; its window lists each stop with the hours spare
          at load-in, and suggests the next jobs that fit, bookable in one tap. <b>Plan a run</b> (route icon) strings
          several offers onto one truck — check every load-in, then book them all; deliver every date well for a run bonus. Single-show offers can be <b>haggled</b> once
          for +12% — a refusal may make the promoter walk, so push when you hold the stronger hand.
        </li>
        <li>
          <b>Abroad</b>: the world map (globe button) shows each world tour's flights. Crossing a border costs <b>visas and
          carnets</b> (EU firms move freely inside the EU; the UK needs carnets for Europe from 2021), and rigs get held at
          customs now and then.
        </li>
        <li>
          <b>Getting your name about</b>: set a marketing budget in Policies for more offers and a slow climb in reputation, and
          decide each year whether to exhibit at the trade shows (PLASA, Prolight + Sound, LDI) — a stand brings a month of
          enquiries and cheaper kit. <b>Low-emission zones</b> (Market) start charging older trucks in big cities from the
          2000s on: check a vehicle's emission class, and retrofit a filter or replace it. A rival may start a{' '}
          <b>price war</b> in a town you work in (see Market) — ride it out, fight back or buy a truce.
        </li>
        <li>
          <b>Owning a venue</b> (open the venue): lease it out for steady rent or promote it yourself for more, with more
          swing. It wears out and asks for refurbishment now and then.
        </li>
        <li>
          <b>Your own festival</b> (Market): pay up front in spring for a field day, weekender or major, pick a headliner
          and ticket price, and hope the economy and the weather play along — a built brand sells out, a new one loses
          money.
        </li>
        <li>
          <b>Tax</b>: on 31 December the taxman takes 15% of the first {kmoney(250_000)} of the year's profit and 30% above it. Losses carry
          forward and half of what you spend on trucks and kit is deductible.
        </li>
        <li>
          <b>Briefing</b> (clipboard button): a sorted list of what needs doing — shows without a truck, rehearsals, thin cash,
          a sponsor you're about to miss — with a tap to go straight to each.
        </li>
        <li>
          <b>Disputes and audits</b>: a promoter unhappy with a poor night may hold back part of your fee, and an insurer may question a
          big claim — settle, argue or send in the lawyers. Every September the council audits each base (the Base tab shows
          your likely score); first aiders, a prep crew that keeps up and a tidy rack help.
        </li>
        <li>
          <b>Speciality</b>: the kind of work you do shapes your name (Finance). Specialists earn more on shows that lean on their
          department and a little less on others; generalists sit in the middle.
        </li>
        <li>
          <b>Getting paid</b>: small venues pay on the night, bigger promoters take 2-6 weeks and sometimes go under. Policies lets you
          sell invoices to a factor for cash now or insure them.
        </li>
        <li>
          <b>Merchandise</b>: on a booked tour you can stock the stands before the first date — a small order is safe, a big one
          only pays if the tour sells out.
        </li>
        <li>
          <b>Tickets</b>: arena and stadium shows are inspected — you need riggers and a first aider in the crew. Hire people who
          have them, or send your own on a course from the crew list (a training room or academy at a warehouse makes it
          cheaper).
        </li>
        <li>
          <b>Fuel</b> follows real history (Market): spikes in 1979-81, 2008 and 2022, a collapse in 1986. Lock the price for 6 or
          12 months if you see a spike coming.
        </li>
        <li>
          <b>The roads change with the years.</b> Real motorways open on their real dates (wider roads with a central
          reservation): quicker, and tolled in Spain, France and Italy (and for lorries in Germany from 2005). Sea crossings
          are ferries — a couple of hours to board plus the fare — until a fixed link opens (the Channel Tunnel in 1994).
        </li>
        <li>
          <b>Over the border</b> (towns with a flag) there are shows but no bases. Borders cost time and money as they did:
          customs and a carnet until the EU single market in 1993, passport queues until Schengen, the GDR's transit
          checks until 1990, Brexit from 2021, and North America's borders always. A show's window lists the ferries,
          borders and tolls on the way; tolls, fares and customs go in the ledger as their own line.
        </li>
        <li>
          <b>Winter</b> (December to March) puts snow on the high roads: mountain passes are slower and a truck crossing
          one needs chains. Plan long runs over the Alps, Pyrenees or Rockies with more slack.
        </li>
        <li>
          <b>Team drivers</b> (a truck's window): two drivers taking turns in a sleeper cab keep it rolling, about a third
          quicker, at a second driver's pay for every hour on the road. Worth it on long hauls — America especially — and
          a waste on short hops. Vans can't take them.
        </li>
        <li>
          <b>Drivers' hours</b> follow the rules of the day: loosely policed tachographs before 1986, the EU rules after,
          digital tachographs from 2007 (and in America, tighter hours of service in 2004 and 2013 and electronic logs from
          2017). Each tightening slows a solo driver; team drivers are unaffected.
        </li>
        <li>
          <b>History happens on the road</b>: strikes, blockades, storms and the 2010 ash cloud slow the roads they cover,
          push fuel up or ground air freight. The news warns a few days ahead and a show's window flags a disrupted road.
        </li>
        <li>
          <b>Every room has quirks</b> (venue and show windows): stairs to load in (one more crew), a curfew (run late into
          it and it's a fine and a cut show), a noise limit (an oversized PA gets limited) or a union house crew to pay.
        </li>
        <li>
          <b>Freight</b>: a booked show's kit can go by rail (cheap, slower; towns and up) or air (dear, quick; cities)
          from any base instead of a truck. Local freelancers crew it, and the kit comes home the same way.
        </li>
        <li>
          <b>Map views</b> (layers button or O): your reputation by town, your market share, and whose patch each town
          is — the company with the most shows there lately.
        </li>
        <li>
          <b>Each country has its own rules</b> (a show's "Local rules" line): in Spain the summer fiestas fill small towns with
          council-booked shows that pay 75 days late; France's intermittents keep freelance crew cheap and plentiful; Germany
          wants a certified Meister für Veranstaltungstechnik (one more rigger) on big shows from 1995; Britain's 1998
          working-time rules add relief crew to big or multi-day shows; and America's right-to-work states (Texas, Georgia,
          Florida…) have no union houses while the north-east and west coast do. Spain has no stagehand unions at all.
        </li>
        <li>
          <b>Tour bus hire</b> (Fleet window): touring acts want a bus and driver for weeks. Buy a coach (a Duple from 1975,
          a Setra sleeper from 1985, the Skyliner from 1994) and hire it out at a day rate — the driver comes out of it, the
          bus wears and can break down mid-tour, and contracts you leave on the table go to rivals.
        </li>
        <li>
          <b>Rehearsals are mandatory</b> for big jobs: arena shows, stadiums, broadcast events and tours can't be booked
          without a rehearsal stage of the right size (Base → Annexes), and an unrehearsed show suffers. Policies has an
          automatic option.
        </li>
        <li>
          <b>Upgrading a base</b>: a warehouse grows up to a production campus, and the Base tab adds annexes — a rehearsal
          stage (rehearse a show or tour for better quality, rent it to bands in between), a workshop bench and a crew lounge.
        </li>
        <li>
          <b>Rivalry</b>: provoke a rival (headhunting, price-war fights) or sit in an aggressive neighbour's patch and the heat
          rises — then come rumours, tampered kit and tip-offs. Pay for security, hit back, or hire an investigator in the League
          to watch them for a quarter.
        </li>
        <li>
          <b>Sponsors &amp; charity</b>: brands will pay a monthly retainer to be on your trucks if you keep a promised number of
          shows a month going (Finance lists them); say yes to a good cause now and then and they call more often.
        </li>
        <li>
          <b>Going public</b>: a big, reputable company can float 30% of itself for cash (Finance). Then shareholders
          want profits and dividends: losses drain their confidence, activists demand action, and a board with no confidence
          at all will throw you out. <b>Headhunting</b>: in the League table you can lure a rival's star tech away at triple
          the usual signing fee — it dents their finances and your reputation, and the star expects a rise.
        </li>
        <li>
          <b>Fleet</b>: the Fleet window is a dashboard — how busy each truck is, what needs attention in the next two
          weeks, and who's earning. Rivals plan runs too: a firm already working an area is likelier to take the next date
          there.
        </li>
        <li>
          <b>Second-hand</b>: when a rival goes under, its kit and trucks go to auction — the price slides daily, but others may
          snap lots up first. <b>Maker partnerships</b> (Policies) give a discount and sponsorship for committing a department
          to one brand. Venue <b>promoters</b> remember your nights: do them proud and they call more and pay more.
        </li>
        <li>
          The world moves: landmark rooms open and close in their real years (the O2 in 2007), towns grow, rivals expand,
          merge and start up. Your <b>annual report</b> lands every New Year, and the League tracks your career milestones.
        </li>
        <li>
          <b>Your goal</b>: you choose one (and a difficulty) when you start a company — see how you're doing in the League,
          along with your legacy score. Reach it and the game keeps going; the score is what you leave behind.
        </li>
        <li>
          <b>Cause and effect</b>: promoters sometimes pay late, so keep a cash cushion — when it runs thin, services and the
          workshop get put off, worn trucks and kit fail, and the next bad night is written up in the League (<i>Post-mortems</i>)
          with the chain that led to it. Clients ask for extras at load-in; give too many away and they expect them. The Money
          window forecasts the next eight weeks.
        </li>
        <li>
          <b>Technical riders</b>: bigger shows need a desk with enough inputs, sometimes a particular console family for the
          engineer's show file, and a PA from the approved list. The show window checks your kit and offers cross-hire from a
          rental house; break the rider and the client holds back part of the fee.
        </li>
        <li>
          <b>The room</b>: clubs and up have limited power, a roof that only takes so much weight and sometimes no dock for an
          artic. The offer warns you, and a booked show offers a generator, ground support or a van shuttle.
        </li>
        <li>
          <b>Crew are people</b>: pairs who work well together become trusted teams (🤝) and deliver more; pairs who clash feud
          (⚡) and cost the show, and past a point refuse to share a truck unless you name them both. Keep people exhausted on
          the road for too long and they burn out for good.
        </li>
        <li>
          <b>Kit is physical</b>: trucks have a payload as well as space, and a load-in has six hours before soundcheck — short
          crews, street load-ins and stairs make it slow. The show window estimates it and offers local loaders.
        </li>
        <li>
          Buy bigger trucks and more gear, and win reputation to unlock arenas and stadiums. Every January the industry awards
          judge your year and the trade press prints its supplier table, the biggest tours and reviews of your best and worst
          shows. Or start from a <b>historic scenario</b> — Live Aid, Italia ’90, Barcelona ’92 — and win a lot of the night.
        </li>
      </ol>
      <p className="tt-dim" style={{ marginBottom: 0 }}>
        Drag to pan, scroll or pinch to zoom. Space pauses; 1–4 set the speed. Install it as an app: on iPhone/iPad use Share →
        Add to Home Screen; on Android use the browser's Install prompt. Vehicles break down more as they age — keep them
        serviced. Wages and running costs tick every day, and three months in the red ends the company.
      </p>
    </div>
  );
}

const COLORS = ['#e11d48', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f97316'];

export function NewGameForm({
  onPreview,
  onStart,
  onCancel,
}: {
  onPreview: (seed: number, hqCityId?: string, country?: CountryCode) => void;
  onStart: (opts: { companyName: string; color: string; seed: number; hqCityId: string; country: CountryCode; startYear: number; difficulty: Difficulty; goal: GoalId; scenario?: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('Roadcase & Rigging');
  const [color, setColor] = useState(COLORS[0]);
  const [seed, setSeed] = useState(() => createRandomSeed());
  const [pickedCountry, setCountry] = useState<CountryCode>(() => guessCountry());
  const [pickedYear, setStartYear] = useState(1990);
  const [scenarioId, setScenarioId] = useState('');
  const sc = getScenario(scenarioId);
  const country = sc?.country ?? pickedCountry;
  const startYear = sc?.startYear ?? pickedYear;
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [goal, setGoal] = useState<GoalId>('sandbox');
  const cities = useMemo(() => suggestedHqCities(seed, country), [seed, country]);
  const [hq, setHq] = useState<string>('');
  const hqId = (sc ? cities.find(c => c.name === sc.hq)?.id : undefined) ?? cities.find(c => c.id === hq)?.id ?? cities.find(c => c.size === 'town')?.id ?? cities[0]?.id;

  useEffect(() => onPreview(seed, hqId, country), [seed, hqId, country, onPreview]);

  return (
    <div className="tt-newgame" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="tt-dim tt-intro" style={{ whiteSpace: 'normal' }}>
        It's {startYear}. You've got two vans, a warehouse and a few flight cases. Build a touring empire.
      </div>
      <label>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Company name
        </div>
        <input className="tt-input" value={name} maxLength={32} onChange={e => setName(e.target.value)} />
      </label>
      <div>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Livery
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <button key={c} className="tt-swatch" style={{ background: c }} data-on={c === color} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
      <div>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Scenario
        </div>
        <select className="tt-input" value={scenarioId} onChange={e => setScenarioId(e.target.value)} aria-label="Scenario">
          <option value="">Free play — pick your own country and year</option>
          {SCENARIOS.map(x => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
        {sc && (
          <div className="tt-dim" style={{ marginTop: 3, fontSize: 11, whiteSpace: 'normal' }}>
            {sc.blurb} Starts {sc.startYear} in {sc.hq}, with a name worth bidding on; you have {sc.years === 1 ? 'a year' : `${sc.years} years`}.
          </div>
        )}
      </div>
      <div style={{ display: sc ? 'none' : undefined }}>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Country
        </div>
        <div className="tt-countries">
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              className="tt-btn sm"
              data-on={c.code === country}
              title={c.name}
              onClick={() => {
                setCountry(c.code);
                setHq('');
              }}
            >
              <span style={{ fontSize: 16 }}>{c.flag}</span> {c.short}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: sc ? 'none' : undefined }}>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Start year
        </div>
        <div className="tt-years">
          {START_YEARS.map(y => (
            <button key={y} className="tt-btn sm" data-on={y === startYear} onClick={() => setStartYear(y)}>
              {y}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Difficulty
        </div>
        <div className="tt-years">
          {DIFFICULTY_IDS.map(d => (
            <button key={d} className="tt-btn sm" data-on={d === difficulty} onClick={() => setDifficulty(d)} title={DIFFICULTIES[d].blurb}>
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
        <div className="tt-dim" style={{ marginTop: 3, fontSize: 11, whiteSpace: 'normal' }}>
          {DIFFICULTIES[difficulty].blurb}
        </div>
      </div>
      <div style={{ display: sc ? 'none' : undefined }}>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Goal
        </div>
        <select className="tt-input" value={goal} onChange={e => setGoal(e.target.value as GoalId)} aria-label="Goal">
          {GOAL_IDS.map(g => (
            <option key={g} value={g}>
              {GOALS[g].label}
            </option>
          ))}
        </select>
        <div className="tt-dim" style={{ marginTop: 3, fontSize: 11, whiteSpace: 'normal' }}>
          {GOALS[goal].blurb}
        </div>
      </div>
      <label style={{ display: sc ? 'none' : undefined }}>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Home town
        </div>
        <select className="tt-input" value={hqId} onChange={e => setHq(e.target.value)}>
          {cities.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({formatPopulation(c.population)})
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button className="tt-btn sm" onClick={() => setSeed(createRandomSeed())}>
          ↻ Reroll terrain
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {onCancel && (
            <button className="tt-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className="tt-btn primary"
            disabled={!name.trim() || !hqId}
            onClick={() => onStart({ companyName: name.trim(), color, seed, hqCityId: hqId!, country, startYear, difficulty, goal: sc ? 'scenario' : goal, scenario: sc?.id })}
          >
            Start company
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverPanel({ state, onRestart }: { state: TycoonState; onRestart: () => void }) {
  return (
    <div style={{ whiteSpace: 'normal' }}>
      <p style={{ marginTop: 0 }}>{state.gameOver?.reason}</p>
      <Stat label="Ended">{formatHour(state, state.gameOver?.hour ?? state.hour)}</Stat>
      <Stat label="Shows played">{state.stats.showsPlayed}</Stat>
      <Stat label="Shows failed">{state.stats.showsFailed}</Stat>
      <Stat label="Peak cash">{money(state.stats.peakCash)}</Stat>
      <Stat label="Peak tier">{tierInfo(companyTier(state.company.reputation)).label}</Stat>
      <Stat label="Legacy score">
        <b>{legacyScore(state).total.toLocaleString('en-US')}</b>
      </Stat>
      {state.goalResult && (
        <Stat label="Goal">
          <span className={state.goalResult.status === 'won' ? 'tt-good' : 'tt-dim'}>
            {GOALS[state.goal ?? 'sandbox'].label} — {state.goalResult.status === 'won' ? 'reached' : 'missed'}
          </span>
        </Stat>
      )}
      <button className="tt-btn primary" style={{ marginTop: 10 }} onClick={onRestart}>
        Start a new company
      </button>
    </div>
  );
}

/** Your goal, its progress and the legacy score so far. */
function CareerPanel({ state }: { state: TycoonState }) {
  const goal = GOALS[state.goal ?? 'sandbox'];
  const progress = goal.progress(state);
  const score = legacyScore(state);
  const deadline = goalDeadlineYear(state);
  return (
    <div style={{ marginBottom: 6 }}>
      <h4 style={{ marginTop: 0 }}>
        Your goal — {goal.label}
        {state.difficulty && state.difficulty !== 'normal' ? <span className="tt-dim"> · {DIFFICULTIES[state.difficulty].label}</span> : null}
      </h4>
      {state.goal && state.goal !== 'sandbox' ? (
        <>
          <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
            {goal.blurb}
            {deadline ? ` (by ${deadline})` : ''}
          </div>
          <div className="tt-row">
            <span style={{ minWidth: 140 }}>{progress.text}</span>
            <Bar value={Math.round(progress.fraction * 100)} max={100} color={state.goalResult?.status === 'won' ? '#22c55e' : state.company.color} />
          </div>
          {state.goalResult && (
            <div className={state.goalResult.status === 'won' ? 'tt-good' : 'tt-dim'} style={{ marginTop: 2 }}>
              {state.goalResult.status === 'won' ? '🏆 Reached — everything from here is a bonus.' : 'The deadline passed. The company carries on.'}
            </div>
          )}
        </>
      ) : (
        <div className="tt-dim">No goal — a sandbox. Pick one when you start a new company.</div>
      )}
      <div className="tt-row" style={{ marginTop: 4 }}>
        <span className="tt-dim" title={score.parts.map(p => `${p.label}: ${p.points}`).join(' · ')}>
          Legacy score
        </span>
        <b>{score.total.toLocaleString('en-US')}</b>
      </div>
    </div>
  );
}

export function LeagueWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const world = worldOf(state);
  const year = yearOf(state, state.hour);
  const rating = companyRating(state, year);
  const rows = [
    {
      id: 'player',
      name: state.company.name,
      color: state.company.color,
      reputation: state.company.reputation,
      shows: state.stats.showsPlayed,
      rating: rating.total,
      base: world.cityById.get(state.company.hqCityId)?.name,
      note: 'You',
    },
    ...state.rivals.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      reputation: r.reputation,
      shows: r.showsPlayed,
      rating: rivalRating(r.reputation, r.showsPlayed + year),
      rival: r,
      base: world.cityById.get(r.hqCityId)?.name,
      note: `${r.specialty} · ${tierInfo(r.minTier).label}${r.maxTier !== r.minTier ? `–${tierInfo(r.maxTier).label}` : ''}`,
    })),
  ].sort((a, b) => b.rating - a.rating);
  return (
    <div>
      <CareerPanel state={state} />
      <table className="tt-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Rating</th>
            <th>Rep</th>
            <th>Shows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={r.id === 'player' ? { background: 'rgba(255,255,255,0.06)' } : undefined}>
              <td>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="tt-dim">{i + 1}.</span>
                  <BrandBadge brand={r.name} color={r.color} size="md" />
                </div>
                <div className="tt-dim" style={{ fontSize: 11, paddingLeft: 30 }}>
                  {r.base} · {r.note}
                </div>
                {'rival' in r && r.rival && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 30, marginTop: 2 }}>
                    <span className="tt-dim" style={{ fontSize: 11 }}>
                      Finances
                    </span>
                    <Bar value={rivalHealth(r.rival)} max={100} color={rivalHealth(r.rival) < 25 ? '#ef4444' : rivalHealth(r.rival) < 50 ? '#f59e0b' : '#22c55e'} />
                    <button
                      className="tt-btn sm"
                      title={takeoverBlocker(state, r.rival) ?? `Buy ${r.name}: their base, kit and crew`}
                      disabled={!!takeoverBlocker(state, r.rival)}
                      onClick={() => {
                        const rv = r.rival!;
                        const res = ctx.dispatch(s => buyRival(s, rv.id));
                        if (res.message) ctx.toast(res.message, res.ok);
                      }}
                    >
                      Buy {kmoney(takeoverPrice(r.rival))}
                    </button>
                  </div>
                )}
                {'rival' in r && r.rival && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 30, marginTop: 2 }}>
                    {(() => {
                      const rv = r.rival!;
                      const star = headhuntTarget(state, rv);
                      const why = headhuntBlocker(state, rv);
                      return (
                        <>
                          <span className="tt-dim" style={{ fontSize: 11, whiteSpace: 'normal' }}>
                            Star: {star.name}, {levelOf(star)}★ {roleOf(star)}
                          </span>
                          <button
                            className="tt-btn sm"
                            title={why ?? `Lure ${star.name} away: costs ${rv.name} 6 finances and you 1 reputation`}
                            disabled={!!why}
                            onClick={() => {
                              const res = ctx.dispatch(s => headhunt(s, rv.id));
                              if (res.message) ctx.toast(res.message, res.ok);
                            }}
                          >
                            Headhunt {kmoney(headhuntFee(star))}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
                {'rival' in r && r.rival && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 30, marginTop: 2 }}>
                    {(() => {
                      const rv = r.rival!;
                      const heat = heatOf(state, rv.id);
                      const watched = hasIntel(state, rv.id);
                      const why = investigatorBlocker(state, rv);
                      const mood = heat >= HEAT_DIRTY ? 'Hostile' : heat >= 15 ? 'Cool' : 'Cordial';
                      return (
                        <>
                          <span className={heat >= HEAT_DIRTY ? 'tt-bad' : 'tt-dim'} style={{ fontSize: 11 }}>
                            {watched || heat >= HEAT_DIRTY ? `Rivalry: ${mood} (${Math.round(heat)}${watched ? `, grudge ${Math.round(aggression(rv) * 100)}%` : ''})` : 'Rivalry: unknown'}
                            {watched ? ' · watched' : ''}
                          </span>
                          <button
                            className="tt-btn sm"
                            title={why ?? `Hire an investigator: ${INTEL_DAYS} days of intel, and ${rv.name} take fewer of your offers`}
                            disabled={!!why}
                            onClick={() => {
                              const res = ctx.dispatch(s => investigate(s, rv.id));
                              if (res.message) ctx.toast(res.message, res.ok);
                            }}
                          >
                            Investigate {kmoney(investigatorCost(state))}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </td>
              <td>
                <b>{r.rating}</b>
              </td>
              <td>{Math.round(r.reputation)}</td>
              <td>{r.shows}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
        Rivals chase the venue sizes they specialise in, and new firms set up as the years go by.
      </div>
      <h4>Your rating, {year} so far</h4>
      {rating.parts.map(p => (
        <div key={p.label} className="tt-row">
          <span className="tt-dim" style={{ minWidth: 120 }}>
            {p.label}
          </span>
          <Bar value={p.points} max={p.max} color={state.company.color} />
          <span style={{ minWidth: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {p.points}/{p.max}
          </span>
        </div>
      ))}
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        The {awardsName(state.country, year + 1)} are handed out every January for the year just gone: beat every rival's rating
        for Production Company of the Year; there are prizes for festivals, touring and newcomers too.
      </div>
      <h4>Trophy cabinet</h4>
      {state.awards.length ? (
        <div className="tt-list">
          {[...state.awards].reverse().map((a, i) => (
            <div key={i} className="tt-row">
              <span>🏆 {a.title}</span>
              <span className="tt-dim">{a.year}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="tt-dim">Empty — for now.</div>
      )}
      <PressCharts state={state} />
      <PostMortems state={state} />
      <h4>
        Milestones ({state.milestones.length}/{MILESTONES.length})
      </h4>
      <div className="tt-list">
        {MILESTONES.map(m => {
          const got = state.milestones.find(x => x.id === m.id);
          return (
            <div key={m.id} className="tt-row" style={{ opacity: got ? 1 : 0.45 }}>
              <span>
                {got ? '🏁' : '▫️'} <b>{m.label}</b> <span className="tt-dim">{m.blurb}</span>
              </span>
              {got && <span className="tt-dim">{formatDay(state, got.day)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The trade press's latest year-end charts: the supplier table, the year's biggest tours and the reviews. */
function PressCharts({ state }: { state: TycoonState }) {
  const chart = state.charts?.[state.charts.length - 1];
  if (!chart) {
    return (
      <>
        <h4>Trade press</h4>
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
          Every New Year the trade press prints the supplier table, the year's biggest tours and reviews of your best and worst nights.
        </div>
      </>
    );
  }
  return (
    <>
      <h4>
        Trade press, {chart.year} (you were {chart.rank} of {chart.firms})
      </h4>
      <div className="tt-list">
        {chart.table.map((r, i) => (
          <div key={r.name} className="tt-row" style={{ fontWeight: r.you ? 700 : undefined }}>
            <span>
              {i + 1}. {r.name}
            </span>
            <span className="tt-dim">{r.score}</span>
          </div>
        ))}
      </div>
      <div className="tt-dim" style={{ margin: '6px 0 2px' }}>
        Biggest tours of {chart.year}
      </div>
      <div className="tt-list">
        {chart.tours.map(t => (
          <div key={t.act} className="tt-row">
            <span>{t.act}</span>
            <span className="tt-dim">{t.yours ? 'your rig ★' : tierInfo(t.tier).label}</span>
          </div>
        ))}
      </div>
      {chart.rave && (
        <div style={{ whiteSpace: 'normal', marginTop: 6 }}>
          ⭐ <b>{chart.rave.act}</b> — “{chart.rave.text}”
        </div>
      )}
      {chart.pan && (
        <div style={{ whiteSpace: 'normal', marginTop: 4 }}>
          📰 <b>{chart.pan.act}</b> — “{chart.pan.text}”
        </div>
      )}
    </>
  );
}

/** The incident log: what went wrong, and the chain of conditions behind it. */
function PostMortems({ state }: { state: TycoonState }) {
  const log = incidentsOf(state).slice(-8).reverse();
  return (
    <>
      <h4>Post-mortems</h4>
      {log.length ? (
        <div className="tt-list">
          {log.map(inc => (
            <div key={inc.id} style={{ whiteSpace: 'normal', marginBottom: 8 }}>
              <div className="tt-row">
                <span>
                  {inc.kind === 'cash' ? '💸' : inc.kind === 'breakdown' ? '🔧' : '🎭'} <b>{inc.title}</b>
                </span>
                <span className="tt-dim">{formatDay(state, Math.floor(inc.hour / 24))}</span>
              </div>
              <div className="tt-dim">{inc.outcome}</div>
              {inc.causes.slice(0, 3).map(c => (
                <div key={c.id} style={{ fontSize: 12, paddingLeft: 10 }}>
                  ↳ <b>{c.label}</b> — {c.detail}
                  {c.link && <span className="tt-dim"> ({chainText(state, c)})</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
          When something goes wrong — a breakdown, a rough night, a bill you couldn't pay — the cause is written up here, including what set it up.
        </div>
      )}
    </>
  );
}

/** The next eight weeks of cash, as an estimate with a range. */
function CashForecast({ state }: { state: TycoonState }) {
  const world = worldOf(state);
  const f = useMemo(() => forecastCash(state, world), [state, world]);
  const hi = Math.max(1, ...f.weeks.map(w => w.high));
  const lo = Math.min(...f.weeks.map(w => w.low));
  const pad = (hi - lo) * 0.1 || 1;
  const top = hi + pad;
  const bottom = lo - pad;
  const span = top - bottom || 1;
  const pct = (v: number) => `${Math.round(((v - bottom) / span) * 100)}%`;
  const nextBills = f.bills.filter(b => b.day <= f.bills[0]?.day).map(b => `${b.label} ${money(b.amount)}`).join(' · ');
  return (
    <>
      <h4>Cash forecast, next {f.weeks.length} weeks</h4>
      <div style={{ display: 'flex', gap: 3, alignItems: 'stretch', height: 54 }}>
        {f.weeks.map(w => (
          <div key={w.week} style={{ flex: 1, position: 'relative', background: 'rgba(255,255,255,0.05)' }} title={`Week ${w.week}: about ${money(w.expected)} (${money(w.low)} to ${money(w.high)})`}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: pct(w.low), top: `calc(100% - ${pct(w.high)})`, background: w.low < 0 ? 'rgba(220,60,60,0.45)' : 'rgba(120,170,255,0.35)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, height: 2, bottom: pct(w.expected), background: w.expected < 0 ? '#ff6b6b' : '#e8eefc' }} />
            {bottom < 0 && top > 0 && <div style={{ position: 'absolute', left: 0, right: 0, height: 1, bottom: pct(0), background: 'rgba(255,255,255,0.35)' }} />}
          </div>
        ))}
      </div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginTop: 4, fontSize: 11 }}>
        Expected low point: <b>{money(f.lowest.expected)}</b> in week {f.lowest.week}. Estimates are good to about ±{Math.round(f.accuracy * 100)}%
        {f.accuracy > 0.12 ? ' — office staff at your bases sharpen it.' : '.'}
        {nextBills ? ` Next bills: ${nextBills}.` : ''}
      </div>
      {f.riskWeek && (
        <div className="tt-bad" style={{ whiteSpace: 'normal', marginTop: 3 }}>
          If invoices run late you could be overdrawn by week {f.riskWeek}.
        </div>
      )}
      {!f.riskWeek && f.squeezeWeek && (
        <div className="tt-dim" style={{ whiteSpace: 'normal', marginTop: 3 }}>
          By week {f.squeezeWeek} cash could be too thin to pay for services, and maintenance would be put off.
        </div>
      )}
    </>
  );
}
