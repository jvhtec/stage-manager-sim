import { useEffect, useMemo, useState } from 'react';
import { borrow, buyRival, repay } from '@/world/actions';
import { rivalHealth, takeoverBlocker, takeoverPrice } from '@/world/rivals';
import {
  START_YEARS,
  NEGATIVE_MONTHS_GAME_OVER,
  TIERS,
  companyTier,
  tierInfo,
} from '@/world/catalog';
import { formatHour, yearOf } from '@/world/core';
import { worldOf } from '@/world/mapgen';
import { companyValue } from '@/world/queries';
import { awardsName, companyRating, rivalRating } from '@/world/awards';
import { describeLoanRate } from '@/world/market';
import { borrowStep, creditLimit } from '@/world/finance';
import { suggestedHqCities } from '@/world/state';
import { LEDGER_LABELS, type LedgerCategory, type TycoonState } from '@/world/types';
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
      <Stat label="Shows played / failed">
        {state.stats.showsPlayed} / <span className={state.stats.showsFailed ? 'tt-bad' : ''}>{state.stats.showsFailed}</span>
      </Stat>
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
          working. Hire from the market each month; keep morale up or rivals poach your stars.
        </li>
        <li>
          Buy bigger trucks and more gear, and win reputation to unlock arenas and stadiums. Every January the industry awards
          judge your year.
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
  onStart: (opts: { companyName: string; color: string; seed: number; hqCityId: string; country: CountryCode; startYear: number }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('Roadcase & Rigging');
  const [color, setColor] = useState(COLORS[0]);
  const [seed, setSeed] = useState(() => createRandomSeed());
  const [country, setCountry] = useState<CountryCode>(() => guessCountry());
  const [startYear, setStartYear] = useState(1990);
  const cities = useMemo(() => suggestedHqCities(seed, country), [seed, country]);
  const [hq, setHq] = useState<string>('');
  const hqId = cities.find(c => c.id === hq)?.id ?? cities.find(c => c.size === 'town')?.id ?? cities[0]?.id;

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
      <div>
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
      <label>
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
          ↻ New map
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
            onClick={() => onStart({ companyName: name.trim(), color, seed, hqCityId: hqId!, country, startYear })}
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
      <button className="tt-btn primary" style={{ marginTop: 10 }} onClick={onRestart}>
        Start a new company
      </button>
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
    </div>
  );
}
