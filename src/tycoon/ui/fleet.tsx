import { useState } from 'react';
import { rehomeVehicle, sellVehicle, sendHome, serviceVehicle, unassignVehicle } from '@/world/actions';
import { SERVICE_INTERVAL_DAYS, getModel } from '@/world/catalog';
import { stockSize } from '@/world/loading';
import { StockLines } from './gear';
import { getTech } from '@/world/content/techs';
import { formatDay, gigById, sellValue, vehicleAgeYears } from '@/world/core';
import { worldOf } from '@/world/mapgen';
import { vehicleActivity } from '@/world/queries';
import { Bar, FatigueChip, Stat } from './bits';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

export function VehicleWindow({ ctx, vehicleId }: { ctx: WinCtx; vehicleId: string }) {
  const { state } = ctx;
  const [relocating, setRelocating] = useState(false);
  const v = state.vehicles.find(x => x.id === vehicleId);
  if (!v) return <div className="tt-dim">This vehicle has been sold.</div>;
  const world = worldOf(state);
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
      <Stat label="Profit this year">
        <span className={v.profitThisYear >= 0 ? 'tt-good' : 'tt-bad'}>{money(v.profitThisYear)}</span>
      </Stat>
      <Stat label="Profit last year">{money(v.profitLastYear)}</Stat>

      <h4>
        Load ({stockSize(v.cargo)}/{model.gearCapacity} gear · {v.crew}/{model.crewSeats} crew)
      </h4>
      {v.crew > 0 && (
        <Stat label="Crew aboard">
          <FatigueChip value={v.crewFatigue ?? 0} />
        </Stat>
      )}
      <StockLines stock={v.cargo} state={state} />

      <h4>Orders</h4>
      {v.orders.length ? (
        <div className="tt-list">
          {v.orders.map((id, i) => {
            const g = gigById(state, id);
            if (!g) return null;
            return (
              <div key={id} className="tt-item clickable" onClick={() => ctx.open('gig', id)}>
                <span className="tt-dim">{i + 1}.</span>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{g.act}</div>
                  <div className="tt-dim">
                    {world.venueById.get(g.venueId)?.name}, {world.cityById.get(g.cityId)?.name} · {formatDay(state, g.day)}
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
          <div className="tt-dim">Then: return to depot.</div>
        </div>
      ) : (
        <div className="tt-dim">No orders. Open a booked show and assign this vehicle to it.</div>
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

export function VehicleListWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const fleet = state.vehicles.filter(v => v.owner === 'player');
  const total = fleet.reduce((s, v) => s + v.profitThisYear, 0);
  return (
    <div>
      <div className="tt-list">
        {fleet.map(v => (
          <div key={v.id} className="tt-item clickable" onClick={() => ctx.open('vehicle', v.id)}>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>
                {v.status === 'broken' ? '⚠ ' : ''}
                {v.name} <span className="tt-dim">{getModel(v.modelId).name}</span>
              </div>
              <div className="tt-dim">{vehicleActivity(state, v)}</div>
            </div>
            <span className={v.profitThisYear >= 0 ? 'tt-good' : 'tt-bad'} style={{ fontWeight: 700 }}>
              {kmoney(v.profitThisYear)}
            </span>
          </div>
        ))}
      </div>
      <div className="tt-row" style={{ marginTop: 6 }}>
        <span className="tt-dim">{fleet.length} vehicles · profit this year</span>
        <b className={total >= 0 ? 'tt-good' : 'tt-bad'}>{money(total)}</b>
      </div>
    </div>
  );
}
