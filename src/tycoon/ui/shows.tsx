import { useState } from 'react';
import { assignVehicle, bookGig, unassignVehicle } from '@/world/actions';
import { DEPT_COLORS, DEPT_LABELS, LOAD_IN_HOUR, SHOW_END_HOUR, SHOW_START_HOUR, companyTier, getModel, tierInfo } from '@/world/catalog';
import { dayOf, formatDay, formatHour, loadInHour, sumCounts } from '@/world/core';
import { getWorld } from '@/world/mapgen';
import { roadDistance } from '@/world/pathfinding';
import { estimateArrival, projectCoverage } from '@/world/queries';
import { DEPTS, type Gig, type TycoonState } from '@/world/types';
import { Bar, Stat, TierChip } from './bits';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

function nearestDepotDistance(state: TycoonState, gig: Gig): number {
  const world = getWorld(state.mapSeed);
  return Math.min(...state.depots.map(d => roadDistance(world, d.cityId, gig.cityId)));
}

export function GigWindow({ ctx, gigId }: { ctx: WinCtx; gigId: string }) {
  const { state } = ctx;
  const gig = state.gigs.find(g => g.id === gigId);
  if (!gig) return <div className="tt-dim">This show has dropped off the books.</div>;
  const world = getWorld(state.mapSeed);
  const venue = world.venueById.get(gig.venueId)!;
  const city = world.cityById.get(gig.cityId)!;
  const today = dayOf(state.hour);
  const tier = companyTier(state.company.reputation);
  const locked = gig.tier > tier;
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };

  const projection = gig.status === 'booked' ? projectCoverage(state, gig) : null;
  const shown = projection?.gear;
  const gearNeed = sumCounts(gig.needs);
  const gearHave = shown ? DEPTS.reduce((s, d) => s + Math.min(shown[d], gig.needs[d]), 0) : 0;
  const rival = state.rivals.find(r => r.id === gig.rivalId);
  const candidates = state.vehicles.filter(v => v.owner === 'player' && !v.orders.includes(gig.id));

  return (
    <div>
      <div className="tt-row">
        <span>
          <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('venue', venue.id)}>
            {venue.name}
          </a>
          ,{' '}
          <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('city', city.id)}>
            {city.name}
          </a>
        </span>
        <TierChip tier={gig.tier} locked={locked && gig.status === 'offer'} />
      </div>
      <Stat label="Show day">
        {formatDay(state, gig.day)}{' '}
        <span className="tt-dim">({gig.day - today >= 0 ? `in ${gig.day - today}d` : `${today - gig.day}d ago`})</span>
      </Stat>
      <Stat label="Timetable">
        Load-in {LOAD_IN_HOUR}:00 · Show {SHOW_START_HOUR}:00–{SHOW_END_HOUR}:00
      </Stat>
      <Stat label="Fee">
        <b>{money(gig.fee)}</b>
      </Stat>
      {gig.status === 'offer' && (
        <Stat label="Book by">
          {formatDay(state, gig.acceptByDay)}{' '}
          <span className="tt-dim">· {Math.round(nearestDepotDistance(state, gig))} tiles from your nearest depot</span>
        </Stat>
      )}

      <h4>Rider</h4>
      <div className="tt-grid">
        {DEPTS.filter(d => gig.needs[d] > 0).map(d => (
          <Row key={d} label={DEPT_LABELS[d]} color={DEPT_COLORS[d]} need={gig.needs[d]} have={shown?.[d]} />
        ))}
        <Row label="Crew" color="#e5e7eb" need={gig.crewNeeded} have={projection?.crew} />
      </div>

      {gig.status === 'offer' && (
        <div style={{ marginTop: 10 }}>
          {locked ? (
            <div className="tt-warn">
              Promoters want reputation {tierInfo(gig.tier).minReputation}+ for {tierInfo(gig.tier).label} venues (you have{' '}
              {Math.round(state.company.reputation)}).
            </div>
          ) : (
            <button className="tt-btn primary" onClick={() => act(s => bookGig(s, gig.id))}>
              Book this show
            </button>
          )}
        </div>
      )}

      {gig.status === 'booked' && projection && (
        <>
          <div className="tt-item" style={{ marginTop: 8 }}>
            <span className="grow">
              {projection.vehicles.length === 0 ? (
                <span className="tt-bad">No vehicles assigned — this will be a no-show.</span>
              ) : !projection.onTime ? (
                <span className="tt-bad">Won't make load-in! Last arrival {formatHour(state, projection.latestArrival)}.</span>
              ) : gearHave < gearNeed || projection.crew < gig.crewNeeded ? (
                <span className="tt-warn">
                  Short: {gearHave}/{gearNeed} gear, {projection.crew}/{gig.crewNeeded} crew.
                </span>
              ) : (
                <span className="tt-good">Fully covered and on time.</span>
              )}
            </span>
          </div>
          <h4>Assigned</h4>
          <div className="tt-list">
            {projection.vehicles.map(v => {
              const eta = estimateArrival(state, v, gig);
              const late = eta > loadInHour(gig);
              return (
                <div key={v.id} className="tt-item clickable" onClick={() => ctx.open('vehicle', v.id)}>
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{v.name}</div>
                    <div className={late ? 'tt-bad' : 'tt-dim'}>ETA {formatHour(state, eta)}</div>
                  </div>
                  <button
                    className="tt-btn sm"
                    onClick={e => {
                      e.stopPropagation();
                      act(s => unassignVehicle(s, v.id, gig.id));
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {!projection.vehicles.length && <div className="tt-dim">None yet.</div>}
          </div>
          <h4>Add a vehicle</h4>
          <div className="tt-list">
            {candidates.map(v => {
              const m = getModel(v.modelId);
              const eta = estimateArrival(state, v, gig);
              const late = eta > loadInHour(gig);
              const busy = v.orders.length > 0;
              return (
                <div key={v.id} className="tt-item">
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>
                      {v.name} <span className="tt-dim">{m.name}</span>
                    </div>
                    <div className="tt-dim">
                      {m.gearCapacity} gear · {m.crewSeats} seats · {world.cityById.get(v.homeCityId)?.name}
                      {busy ? ` · ${v.orders.length} job${v.orders.length > 1 ? 's' : ''} before` : ''}
                    </div>
                    <div className={late ? 'tt-bad' : 'tt-good'} style={{ fontSize: 11.5 }}>
                      {Number.isFinite(eta) ? `ETA ${formatHour(state, eta)}${late ? ' — late!' : ''}` : 'No road'}
                    </div>
                  </div>
                  <button className="tt-btn sm primary" disabled={!Number.isFinite(eta)} onClick={() => act(s => assignVehicle(s, v.id, gig.id))}>
                    + Assign
                  </button>
                </div>
              );
            })}
            {!candidates.length && <div className="tt-dim">Every vehicle is already on this job.</div>}
          </div>
        </>
      )}

      {gig.result && gig.status !== 'rival' && (
        <>
          <h4>Result</h4>
          <Stat label="Show quality">
            <b className={gig.status === 'done' ? 'tt-good' : 'tt-bad'}>{Math.round(gig.result.quality * 100)}%</b>
          </Stat>
          <Stat label="Gear delivered">{Math.round(gig.result.gearCoverage * 100)}%</Stat>
          <Stat label="Crew delivered">{Math.round(gig.result.crewCoverage * 100)}%</Stat>
          <Stat label="Late to load-in">{gig.result.lateHours ? `${gig.result.lateHours}h` : 'On time'}</Stat>
          <Stat label={gig.result.payout >= 0 ? 'Paid' : 'Penalty'}>
            <b className={gig.result.payout >= 0 ? 'tt-good' : 'tt-bad'}>{money(gig.result.payout)}</b>
          </Stat>
        </>
      )}
      {gig.status === 'rival' && rival && (
        <div style={{ marginTop: 8 }}>
          Won by <b style={{ color: rival.color }}>{rival.name}</b>.
        </div>
      )}
      {gig.status === 'expired' && <div className="tt-dim" style={{ marginTop: 8 }}>Nobody booked it in time.</div>}

      <div style={{ marginTop: 10 }}>
        <button className="tt-btn sm" onClick={() => ctx.goTo(venue.x + venue.w / 2, venue.y + venue.h / 2)}>
          Show on map
        </button>
      </div>
    </div>
  );
}

function Row({ label, color, need, have }: { label: string; color: string; need: number; have?: number }) {
  return (
    <>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
        {label}
      </span>
      {have === undefined ? <span /> : <Bar value={have} max={need} color={have >= need ? '#4ade80' : '#fbbf24'} />}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {have === undefined ? need : `${Math.min(have, need)}/${need}`}
      </span>
    </>
  );
}

export function ShowsWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const [tab, setTab] = useState<'offers' | 'booked' | 'history'>('offers');
  const world = getWorld(state.mapSeed);
  const today = dayOf(state.hour);
  const tier = companyTier(state.company.reputation);
  const offers = state.gigs
    .filter(g => g.status === 'offer' && g.acceptByDay >= today)
    .sort((a, b) => Number(a.tier > tier) - Number(b.tier > tier) || nearestDepotDistance(state, a) - nearestDepotDistance(state, b));
  const booked = state.gigs.filter(g => g.status === 'booked').sort((a, b) => a.day - b.day);
  const history = state.gigs
    .filter(g => g.status === 'done' || g.status === 'failed')
    .sort((a, b) => b.day - a.day);
  const list = tab === 'offers' ? offers : tab === 'booked' ? booked : history;

  return (
    <div>
      <div className="tt-tabs">
        <button className="tt-btn sm" data-on={tab === 'offers'} onClick={() => setTab('offers')}>
          Offers ({offers.length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'booked'} onClick={() => setTab('booked')}>
          Booked ({booked.length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'history'} onClick={() => setTab('history')}>
          History
        </button>
      </div>
      <div className="tt-list">
        {list.map(g => {
          const venue = world.venueById.get(g.venueId);
          const city = world.cityById.get(g.cityId);
          const dist = nearestDepotDistance(state, g);
          let right: React.ReactNode = <b>{kmoney(g.fee)}</b>;
          if (tab === 'booked') {
            const p = projectCoverage(state, g);
            const ok = p.vehicles.length > 0 && p.onTime && DEPTS.every(d => p.gear[d] >= g.needs[d]) && p.crew >= g.crewNeeded;
            right = (
              <span className={!p.vehicles.length || !p.onTime ? 'tt-bad' : ok ? 'tt-good' : 'tt-warn'} style={{ fontWeight: 800 }}>
                {!p.vehicles.length ? 'UNASSIGNED' : !p.onTime ? 'LATE' : ok ? 'READY' : 'SHORT'}
              </span>
            );
          } else if (tab === 'history') {
            right = (
              <span className={g.status === 'done' ? 'tt-good' : 'tt-bad'} style={{ fontWeight: 800 }}>
                {money(g.result?.payout ?? 0)}
              </span>
            );
          }
          return (
            <div key={g.id} className="tt-item clickable" onClick={() => ctx.open('gig', g.id)}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{g.act}</div>
                <div className="tt-dim">
                  {venue?.name}, {city?.name} · {formatDay(state, g.day)}
                  {tab === 'offers' ? ` · ${Math.round(dist)} tiles` : ''}
                </div>
              </div>
              {tab === 'offers' && <TierChip tier={g.tier} locked={g.tier > tier} />}
              {right}
            </div>
          );
        })}
        {!list.length && <div className="tt-dim">Nothing here yet.</div>}
      </div>
    </div>
  );
}
