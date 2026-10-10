import { useState } from 'react';
import { bookAndAssign, retrofitVehicle, rehomeVehicle, sellVehicle, sendHome, serviceVehicle, setTeamDrivers, unassignVehicle } from '@/world/actions';
import { leaseReturnPenalty } from '@/world/finance';
import { SERVICE_INTERVAL_DAYS, getModel } from '@/world/catalog';
import { stockSize } from '@/world/loading';
import { StockLines } from './gear';
import { getTech } from '@/world/content/techs';
import { TEAM_DRIVER_PER_HOUR, TEAM_PACE, formatDay, gigById, loadInHour, sellValue, vehicleAgeYears, vehicleSpeed } from '@/world/core';
import { worldOf } from '@/world/mapgen';
import { estimateArrival, suggestJobs, vehicleActivity } from '@/world/queries';
import { roadDistance } from '@/world/pathfinding';
import { fleetSummary } from '@/world/fleetReport';
import { retrofitBlocker, retrofitCost, vehicleClass } from '@/world/regulation';
import { Bar, Stat } from './bits';
import { PersonRow } from './crewWindow';
import { distance, kmoney, money } from './format';
import type { WinCtx } from './types';

export function VehicleWindow({ ctx, vehicleId }: { ctx: WinCtx; vehicleId: string }) {
  const { state } = ctx;
  const [relocating, setRelocating] = useState(false);
  const v = state.vehicles.find(x => x.id === vehicleId);
  if (!v) return <div className="tt-dim">This vehicle has been sold.</div>;
  const world = worldOf(state);
  const suggestions = suggestJobs(state, v);
  const model = getModel(v.modelId);
  const age = vehicleAgeYears(v, state.hour);
  const atHome = v.cityId === v.homeCityId && (v.status === 'parked' || v.status === 'scheduled');
  const daysSinceService = Math.floor((state.hour - v.lastServiceHour) / 24);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const following = ctx.followingId === v.id;
  const aboard = state.techs.filter(t => t.vehicleId === v.id);

  return (
    <div>
      <div className="tt-item" style={{ marginBottom: 6 }}>
        <span className="grow" style={{ fontWeight: 700 }}>
          {v.status === 'broken' ? <span className="tt-bad">⚠ </span> : null}
          {vehicleActivity(state, v)}
        </span>
        <button className="tt-btn sm" data-on={following} onClick={() => ctx.follow(following ? null : v.id)}>
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
      {aboard.length > 0 && (
        <div className="tt-item clickable" style={{ marginBottom: 6 }} onClick={() => ctx.open('talent')}>
          <span>🎧</span>
          <span className="grow">
            {aboard.map(t => `${getTech(t.techId).name} (${getTech(t.techId).role})`).join(', ')} riding along
          </span>
        </div>
      )}
      <Stat label="Model">{model.name}</Stat>
      <Stat label="Home depot">{world.cityById.get(v.homeCityId)?.name}</Stat>
      <Stat label="Age">
        {age.toFixed(1)} / {model.lifespanYears} yrs {age > model.lifespanYears ? <span className="tt-bad">(old)</span> : null}
      </Stat>
      <div className="tt-row">
        <span className="tt-dim">Reliability</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Bar value={v.reliability} max={100} color={v.reliability > 70 ? '#4ade80' : v.reliability > 45 ? '#fbbf24' : '#f87171'} />
          {Math.round(v.reliability)}%
        </span>
      </div>
      <Stat label="Last service">
        {daysSinceService}d ago <span className="tt-dim">(every {SERVICE_INTERVAL_DAYS}d)</span>
      </Stat>
      {v.owner === 'player' && (
        <Stat label="Emission class">
          <b>{vehicleClass(v, state)}</b>
          {(v.retrofit ?? 0) > 0 && <span className="tt-dim"> (filter ×{v.retrofit})</span>}
          {atHome && !retrofitBlocker(state, v) && (
            <button className="tt-btn sm" style={{ marginLeft: 6 }} onClick={() => act(s => retrofitVehicle(s, v.id))} title="Fit a particulate filter: one class cleaner">
              Retrofit {money(retrofitCost(v))}
            </button>
          )}
        </Stat>
      )}
      {v.owner === 'player' && model.kind !== 'van' && (
        <Stat label="Drivers">
          {v.teamDrivers ? (
            <>
              <b>Team</b> <span className="tt-dim">· {Math.round((TEAM_PACE - 1) * 100)}% quicker · +{money(TEAM_DRIVER_PER_HOUR)}/h on the road</span>
            </>
          ) : (
            <span className="tt-dim">One driver</span>
          )}
          <button
            className="tt-btn sm"
            style={{ marginLeft: 6 }}
            data-on={!!v.teamDrivers}
            onClick={() => act(s => setTeamDrivers(s, v.id, !v.teamDrivers))}
            title="Two drivers taking turns in a sleeper cab keep the truck rolling: worth it on long hauls, an expense on short hops."
          >
            {v.teamDrivers ? 'One driver' : 'Team drivers'}
          </button>
        </Stat>
      )}
      <Stat label="Profit this year">
        <span className={v.profitThisYear >= 0 ? 'tt-good' : 'tt-bad'}>{money(v.profitThisYear)}</span>
      </Stat>
      <Stat label="Profit last year">{money(v.profitLastYear)}</Stat>
      {v.lease && <Stat label="Leased">{money(v.lease.monthly)}/month</Stat>}

      <h4>
        Load ({stockSize(v.cargo)}/{model.gearCapacity} gear · {v.crew}/{model.crewSeats} crew)
      </h4>
      {v.crew > 0 && (
        <div className="tt-list" style={{ marginBottom: 6 }}>
          {state.people
            .filter(m => m.vehicleId === v.id)
            .map(m => (
              <PersonRow key={m.id} state={state} m={m} />
            ))}
        </div>
      )}
      {state.people.some(m => m.pinnedVehicleId === v.id) && (
        <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 4 }}>
          📌 Regulars:{' '}
          {state.people
            .filter(m => m.pinnedVehicleId === v.id)
            .map(m => m.name)
            .join(', ')}{' '}
          — they always ride this truck (pin people in the crew window).
        </div>
      )}
      <StockLines stock={v.cargo} state={state} />

      <h4>Orders</h4>
      {v.orders.length ? (
        <div className="tt-list">
          {v.orders.map((id, i) => {
            const g = gigById(state, id);
            if (!g) return null;
            // Can the truck make it? Arrival after the shows before this one, against this one's load-in.
            const spare = loadInHour(g) - estimateArrival(state, v, g);
            const prevCity = i === 0 ? (v.status === 'driving' || v.status === 'broken' ? v.route!.to : v.cityId ?? v.homeCityId) : gigById(state, v.orders[i - 1])?.cityId;
            const leg = prevCity ? roadDistance(world, prevCity, g.cityId) : NaN;
            return (
              <div key={id} className="tt-item clickable" onClick={() => ctx.open('gig', id)}>
                <span className="tt-dim">{i + 1}.</span>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{g.act}</div>
                  <div className="tt-dim">
                    {world.venueById.get(g.venueId)?.name}, {world.cityById.get(g.cityId)?.name} · {formatDay(state, g.day)}
                  </div>
                  <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                    {Number.isFinite(leg) && leg > 0 ? `${distance(leg)} on · ` : ''}
                    <span className={spare < 0 ? 'tt-bad' : spare < 6 ? 'tt-warn' : 'tt-good'}>
                      {spare < 0 ? `late by ${Math.ceil(-spare)}h` : spare < 6 ? `tight: ${Math.floor(spare)}h spare` : `${Math.floor(spare)}h spare at load-in`}
                    </span>
                  </div>
                </div>
                <button
                  className="tt-btn sm"
                  onClick={e => {
                    e.stopPropagation();
                    act(s => unassignVehicle(s, v.id, id));
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          <div className="tt-dim">
            Then: return to depot
            {(() => {
              const last = gigById(state, v.orders[v.orders.length - 1]);
              const back = last ? roadDistance(world, last.cityId, v.homeCityId) : NaN;
              return Number.isFinite(back) && back > 0 ? ` — ${distance(back)}, about ${Math.ceil(back / vehicleSpeed(v))}h.` : '.';
            })()}
          </div>
        </div>
      ) : (
        <div className="tt-dim">No orders. Open a booked show and assign this vehicle to it.</div>
      )}

      {v.owner === 'player' && suggestions.length > 0 && (
        <>
          <h4>Suggested next jobs</h4>
          <div className="tt-list">
            {suggestions.map(s => (
              <div key={s.gig.id} className="tt-item" style={{ gap: 6 }}>
                <div className="grow clickable" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => ctx.open('gig', s.gig.id)}>
                  <b>{s.gig.act}</b>
                  <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                    {world.venueById.get(s.gig.venueId)?.name}, {world.cityById.get(s.gig.cityId)?.name} · {formatDay(state, s.gig.day)} · {distance(s.distance)} on
                  </div>
                </div>
                <button className="tt-btn sm primary" onClick={() => act(st => bookAndAssign(st, v.id, s.gig.id))}>
                  Book {kmoney(s.gig.fee)}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {v.owner === 'player' && (
        <button className="tt-btn sm" onClick={() => ctx.open('planner', v.id)} style={{ marginTop: 6 }}>
          Plan a run with this truck…
        </button>
      )}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
        <button className="tt-btn sm" disabled={!v.orders.length} onClick={() => act(s => sendHome(s, v.id))}>
          Send home
        </button>
        <button className="tt-btn sm" disabled={!atHome} onClick={() => act(s => serviceVehicle(s, v.id))}>
          Service now
        </button>
        <button className="tt-btn sm" disabled={!atHome || state.depots.length < 2 || v.orders.length > 0} onClick={() => setRelocating(r => !r)}>
          Relocate…
        </button>
        {v.lease ? (
          <button
            className="tt-btn sm"
            disabled={!atHome}
            onClick={() => {
              const penalty = leaseReturnPenalty(state, v);
              if (window.confirm(penalty ? `Hand ${v.name} back early? Penalty ${money(penalty)}.` : `Hand ${v.name} back?`)) {
                act(s => sellVehicle(s, v.id));
                ctx.close();
              }
            }}
          >
            Hand back{leaseReturnPenalty(state, v) ? ` (−${kmoney(leaseReturnPenalty(state, v))})` : ''}
          </button>
        ) : (
          <button
            className="tt-btn sm"
            disabled={!atHome}
            onClick={() => {
              if (window.confirm(`Sell ${v.name} for ${money(sellValue(v, state.hour))}?`)) {
                act(s => sellVehicle(s, v.id));
                ctx.close();
              }
            }}
          >
            Sell {kmoney(sellValue(v, state.hour))}
          </button>
        )}
      </div>
      {relocating && (
        <div className="tt-list" style={{ marginTop: 6 }}>
          {state.depots
            .filter(d => d.cityId !== v.homeCityId)
            .map(d => (
              <button
                key={d.id}
                className="tt-btn sm"
                onClick={() => {
                  act(s => rehomeVehicle(s, v.id, d.id));
                  setRelocating(false);
                }}
              >
                Move to {world.cityById.get(d.cityId)?.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

type FleetSort = 'profit' | 'busy' | 'age' | 'name';

/** Company-wide fleet dashboard: KPIs, what needs attention, and every vehicle ranked. */
export function VehicleListWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const [sort, setSort] = useState<FleetSort>('profit');
  const summary = fleetSummary(state);
  const rows = [...summary.rows].sort((a, b) =>
    sort === 'profit' ? b.profit - a.profit : sort === 'busy' ? b.utilisation - a.utilisation : sort === 'age' ? b.ageYears - a.ageYears : a.vehicle.name.localeCompare(b.vehicle.name),
  );
  const tile = (label: string, value: React.ReactNode, hint?: string, tone?: 'good' | 'warn' | 'bad') => (
    <div key={label} className="tt-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0, flex: '1 1 30%', minWidth: 96 }} title={hint}>
      <span className="tt-dim" style={{ fontSize: 11 }}>
        {label}
      </span>
      <b className={tone ? `tt-${tone}` : ''} style={{ fontSize: 15 }}>
        {value}
      </b>
    </div>
  );
  const busyPct = Math.round(summary.avgUtilisation * 100);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {tile('Vehicles', summary.count, `${summary.onTheRoad} on the road, ${summary.idle} idle, ${summary.inWorkshop} in the workshop`)}
        {tile('Busy', `${busyPct}%`, 'Average share of days working or booked, over the last ~50 days', busyPct >= 60 ? 'good' : busyPct >= 35 ? 'warn' : 'bad')}
        {tile('On the road', summary.onTheRoad)}
        {tile('Idle now', summary.idle, undefined, summary.idle > 0 && summary.idle === summary.count ? 'warn' : undefined)}
        {tile('Reliability', `${Math.round(summary.avgReliability)}%`, 'Average across the fleet', summary.avgReliability >= 70 ? 'good' : summary.avgReliability >= 45 ? 'warn' : 'bad')}
        {tile('Avg age', `${summary.avgAge.toFixed(1)} yrs`)}
        {tile('Next 14 days', `${summary.upcoming.covered}/${summary.upcoming.total}`, 'Booked shows fully covered, of those coming up', summary.upcoming.total && summary.upcoming.covered < summary.upcoming.total ? 'warn' : 'good')}
        {tile('Profit YTD', money(summary.profit), undefined, summary.profit >= 0 ? 'good' : 'bad')}
      </div>

      <h4>Needs attention{summary.alerts.length ? ` (${summary.alerts.length})` : ''}</h4>
      {summary.alerts.length ? (
        <div className="tt-list">
          {summary.alerts.slice(0, 8).map(a => (
            <div
              key={a.id}
              className="tt-item clickable"
              style={{ gap: 6 }}
              onClick={() => (a.gigId ? ctx.open('gig', a.gigId) : a.vehicleId && ctx.open('vehicle', a.vehicleId))}
            >
              <span style={{ width: 8, height: 22, borderRadius: 2, flexShrink: 0, background: a.severity === 'bad' ? '#ef4444' : a.severity === 'warn' ? '#f59e0b' : '#64748b' }} />
              <span className="grow" style={{ whiteSpace: 'normal' }}>
                {a.text}
              </span>
              <span className="tt-dim">›</span>
            </div>
          ))}
          {summary.alerts.length > 8 && <div className="tt-dim">…and {summary.alerts.length - 8} more.</div>}
        </div>
      ) : (
        <div className="tt-good">All clear — everything booked is covered and the fleet is in shape.</div>
      )}

      <h4>The fleet</h4>
      <div className="tt-tabs" style={{ marginBottom: 4 }}>
        {(['profit', 'busy', 'age', 'name'] as FleetSort[]).map(k => (
          <button key={k} className="tt-btn sm" data-on={sort === k} onClick={() => setSort(k)}>
            {k === 'busy' ? 'Busiest' : k === 'age' ? 'Oldest' : k === 'profit' ? 'Profit' : 'Name'}
          </button>
        ))}
      </div>
      <div className="tt-list">
        {rows.map(r => {
          const v = r.vehicle;
          return (
            <div key={v.id} className="tt-item clickable" onClick={() => ctx.open('vehicle', v.id)}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {v.status === 'broken' ? '⚠ ' : ''}
                  {v.name} <span className="tt-dim">{getModel(v.modelId).name}</span>
                  {v.lease ? <span className="tt-dim"> · leased</span> : null}
                </div>
                <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                  {vehicleActivity(state, v)}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  <Bar value={Math.round(r.utilisation * 100)} max={100} color={r.utilisation >= 0.6 ? '#22c55e' : r.utilisation >= 0.3 ? '#f59e0b' : '#ef4444'} />
                  <span className="tt-dim" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {Math.round(r.utilisation * 100)}% busy · {Math.round(v.reliability)}% rel · {r.ageYears.toFixed(1)}y
                  </span>
                </div>
              </div>
              <span className={r.profit >= 0 ? 'tt-good' : 'tt-bad'} style={{ fontWeight: 700 }}>
                {kmoney(r.profit)}
              </span>
            </div>
          );
        })}
      </div>
      {summary.best && summary.worst && summary.count > 1 && (
        <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
          Best earner: {summary.best.vehicle.name} ({kmoney(summary.best.profit)}) · weakest: {summary.worst.vehicle.name} ({kmoney(summary.worst.profit)}).
        </div>
      )}
    </div>
  );
}
