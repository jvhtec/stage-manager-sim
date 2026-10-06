import { useEffect, useMemo, useState } from 'react';
import { borrow, repay } from '@/world/actions';
import {
  LOAN_INTEREST_PER_YEAR,
  LOAN_STEP,
  MAX_LOAN,
  NEGATIVE_MONTHS_GAME_OVER,
  TIERS,
  companyTier,
  tierInfo,
} from '@/world/catalog';
import { formatHour, yearOf } from '@/world/core';
import { getWorld } from '@/world/mapgen';
import { companyValue } from '@/world/queries';
import { suggestedHqCities } from '@/world/state';
import { LEDGER_LABELS, type LedgerCategory, type TycoonState } from '@/world/types';
import { createRandomSeed } from '@/lib/rng';
import { Bar, Stat } from './bits';
import { money } from './format';
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
        {money(state.company.loan)} <span className="tt-dim">/ {money(MAX_LOAN)} @ {Math.round(LOAN_INTEREST_PER_YEAR * 100)}%</span>
      </Stat>
      <Stat label="Company value">{money(companyValue(state))}</Stat>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button className="tt-btn sm" disabled={state.company.loan + LOAN_STEP > MAX_LOAN} onClick={() => act(borrow)}>
          Borrow {money(LOAN_STEP)}
        </button>
        <button className="tt-btn sm" disabled={state.company.loan <= 0} onClick={() => act(repay)}>
          Repay {money(Math.min(LOAN_STEP, state.company.loan))}
        </button>
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
  const world = getWorld(state.mapSeed);
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
        <li>Assign one truck to several shows and it tours — straight from venue to venue.</li>
        <li>Buy bigger trucks and more gear, open regional warehouses, and win reputation to unlock arenas and stadiums.</li>
      </ol>
      <p className="tt-dim" style={{ marginBottom: 0 }}>
        Drag to pan, scroll or pinch to zoom. Space pauses; 1–4 set the speed. Vehicles break down more as they age — keep them
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
  onPreview: (seed: number, hqCityId?: string) => void;
  onStart: (opts: { companyName: string; color: string; seed: number; hqCityId: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('Roadcase & Rigging');
  const [color, setColor] = useState(COLORS[0]);
  const [seed, setSeed] = useState(() => createRandomSeed());
  const cities = useMemo(() => suggestedHqCities(seed), [seed]);
  const [hq, setHq] = useState<string>('');
  const hqId = cities.find(c => c.id === hq)?.id ?? cities.find(c => c.size === 'town')?.id ?? cities[0]?.id;

  useEffect(() => onPreview(seed, hqId), [seed, hqId, onPreview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
        It's 1990. You've got two vans, a warehouse and a few flight cases. Build a touring empire.
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
      <label>
        <div className="tt-dim" style={{ marginBottom: 3 }}>
          Home town
        </div>
        <select className="tt-input" value={hqId} onChange={e => setHq(e.target.value)}>
          {cities.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.size}, {Math.round(c.population / 1000)}k)
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
            onClick={() => onStart({ companyName: name.trim(), color, seed, hqCityId: hqId! })}
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
