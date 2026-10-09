import { useMemo, useState } from 'react';
import { bookRun } from '@/world/actions';
import { RUN_BONUS_CAP, RUN_BONUS_PER_DATE, planRun, runCandidates } from '@/world/runs';
import { formatDay } from '@/world/core';
import { worldOf } from '@/world/mapgen';
import { roadDistance } from '@/world/pathfinding';
import { gigBookingBar } from '@/world/standing';
import { Stat } from './bits';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

/** String several offers onto one truck: see the timing, the driving and the bonus before you commit. */
export function PlannerWindow({ ctx, vehicleId }: { ctx: WinCtx; vehicleId?: string }) {
  const { state } = ctx;
  const world = worldOf(state);
  const fleet = state.vehicles.filter(v => v.owner === 'player');
  const [vid, setVid] = useState(vehicleId ?? fleet[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const v = fleet.find(x => x.id === vid) ?? fleet[0];
  const candidates = useMemo(() => (v ? runCandidates(state, v).slice(0, 40) : []), [state, v]);
  if (!v) return <div className="tt-dim">You have no vehicles.</div>;
  const plan = planRun(state, v, picked.filter(id => candidates.some(c => c.id === id)));
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
    return r.ok;
  };
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const spareOf = new Map(plan.stops.map(s => [s.gig.id, s]));

  return (
    <div>
      <div className="tt-row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <span className="tt-dim">Truck</span>
        <select
          className="tt-input"
          value={v.id}
          onChange={e => {
            setVid(e.target.value);
            setPicked([]);
          }}
        >
          {fleet.map(f => (
            <option key={f.id} value={f.id}>
              {f.name} — {world.cityById.get(f.homeCityId)?.name}
            </option>
          ))}
        </select>
      </div>
      <div className="tt-dim" style={{ marginBottom: 6, whiteSpace: 'normal' }}>
        Tick the shows to string together. Every date after the first adds {Math.round(RUN_BONUS_PER_DATE * 100)}% (up to {Math.round(RUN_BONUS_CAP * 100)}%) on top of the fees — paid when the whole run is delivered cleanly.
      </div>

      <div className="tt-list">
        {candidates.map(g => {
          const on = picked.includes(g.id);
          const stop = spareOf.get(g.id);
          const reason = gigBookingBar(state, g).reason;
          return (
            <div key={g.id} className="tt-item" style={{ gap: 6, opacity: reason ? 0.5 : 1 }}>
              <input type="checkbox" checked={on} disabled={!!reason} onChange={() => toggle(g.id)} aria-label={`Include ${g.act}`} />
              <div className="grow" style={{ minWidth: 0 }}>
                <b>{g.act}</b>
                <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                  {world.venueById.get(g.venueId)?.name}, {world.cityById.get(g.cityId)?.name} · {formatDay(state, g.day)} · {Math.round(roadDistance(world, v.homeCityId, g.cityId))} tiles from base
                  {reason ? ` · ${reason}` : ''}
                </div>
                {on && stop && (
                  <div style={{ fontSize: 11 }} className={stop.spare < 0 ? 'tt-bad' : stop.spare < 6 ? 'tt-warn' : 'tt-good'}>
                    {stop.leg ? `${Math.round(stop.leg)} tiles on · ` : ''}
                    {stop.spare < 0 ? `late by ${Math.ceil(-stop.spare)}h` : `${Math.floor(stop.spare)}h spare`}
                  </div>
                )}
              </div>
              <b>{kmoney(g.fee)}</b>
            </div>
          );
        })}
        {!candidates.length && <div className="tt-dim">No open offers in this truck's reach right now. Check back as new shows are posted.</div>}
      </div>

      {plan.stops.length > 0 && (
        <>
          <h4>The run</h4>
          <Stat label="Dates">{plan.stops.length}</Stat>
          <Stat label="Fees">{money(plan.fees)}</Stat>
          <Stat label="Run bonus">
            {plan.bonusRate ? (
              <b className="tt-good">
                +{money(plan.bonus)} <span className="tt-dim">({Math.round(plan.bonusRate * 100)}%)</span>
              </b>
            ) : (
              <span className="tt-dim">add a second date</span>
            )}
          </Stat>
          <Stat label="Driving">
            {Math.round(plan.distance)} tiles · fuel {money(plan.fuel)}
          </Stat>
          <Stat label="Nights away">
            {plan.nights} · {money(plan.travel)}
          </Stat>
          <Stat label="Net (before wear and wages)">
            <b className={plan.net >= 0 ? 'tt-good' : 'tt-bad'}>{money(plan.net)}</b>
          </Stat>
          {!plan.feasible && (
            <div className="tt-warn" style={{ whiteSpace: 'normal', marginTop: 4 }}>
              {plan.stops.some(s => s.spare < 0) ? 'The truck can’t make every load-in — drop a date or pick a closer one.' : 'One of these can’t be booked right now.'}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button
              className="tt-btn primary"
              disabled={!plan.feasible}
              onClick={() => {
                if (act(s => bookRun(s, v.id, plan.stops.map(x => x.gig.id)))) setPicked([]);
              }}
            >
              Book the run
            </button>
            <button className="tt-btn" onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}
