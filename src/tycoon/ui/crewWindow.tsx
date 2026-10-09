import { useState } from 'react';
import { answerPoach, fireMember, hireCandidate, hireCrew, pinCrew, setCrewPicks } from '@/world/actions';
import { CREW_HIRE_COST } from '@/world/catalog';
import { PAY } from '@/world/crew';
import { CREW_DEPTS, CREW_DEPT_LABEL, REST_AT, TRAITS, dayRate, evaluateCrew, hireFee, levelOf, roleOf } from '@/world/people';
import { worldOf } from '@/world/mapgen';
import type { CrewMember, Gig, TycoonState } from '@/world/types';
import { FatigueChip, Stat } from './bits';
import { money } from './format';
import type { WinCtx } from './types';

const DEPT_COLOR: Record<CrewMember['primary'], string> = { audio: '#3b82f6', lighting: '#f59e0b', video: '#a855f7', stage: '#10b981' };

export function Stars({ n }: { n: number }) {
  const full = Math.max(0, Math.min(5, Math.floor(n)));
  return (
    <span style={{ color: '#facc15', letterSpacing: -1, whiteSpace: 'nowrap' }} title={`${full} of 5`}>
      {'★'.repeat(full)}
      <span style={{ color: 'rgba(255,255,255,0.18)' }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
}

/** One person: name, role, stars, second string, trait, fatigue. */
export function PersonRow({ state, m, right }: { state: TycoonState; m: CrewMember; right?: React.ReactNode }) {
  const second = CREW_DEPTS.filter(d => d !== m.primary && m.skills[d] >= 1).sort((a, b) => m.skills[b] - m.skills[a])[0];
  const pay = PAY[state.policies.pay].wage;
  return (
    <div className="tt-item" style={{ gap: 6 }}>
      <span style={{ width: 8, height: 26, borderRadius: 2, background: DEPT_COLOR[m.primary], flexShrink: 0 }} title={CREW_DEPT_LABEL[m.primary]} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{m.name}</b> <Stars n={levelOf(m)} />
          {m.trait && (
            <span className="tt-chip" style={{ background: '#334155' }} title={TRAITS[m.trait].blurb}>
              {TRAITS[m.trait].label}
            </span>
          )}
        </div>
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
          {roleOf(m)}
          {second ? ` · also ${CREW_DEPT_LABEL[second].toLowerCase()} ${Math.floor(m.skills[second])}★` : ''} · {money(Math.round(dayRate(m) * pay))}/day{' '}
          {m.fatigue >= 30 && <FatigueChip value={m.fatigue} />}
          {m.depotId && m.fatigue >= REST_AT[state.policies.rest] && !m.pinnedVehicleId && <span className="tt-chip" style={{ background: '#475569' }}>resting</span>}
          {m.pinnedVehicleId && !right && (
            <span className="tt-chip" style={{ background: '#1e3a8a' }} title="Always rides this truck">
              📌 {state.vehicles.find(v => v.id === m.pinnedVehicleId)?.name ?? '?'}
            </span>
          )}
          {(m.payBump ?? 1) > 1 && <span className="tt-dim"> · +{Math.round(((m.payBump ?? 1) - 1) * 100)}% retention</span>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Name exactly who works a booked show: tap people at the bases its trucks leave from. */
export function CrewPicker({ ctx, gig }: { ctx: WinCtx; gig: Gig }) {
  const { state } = ctx;
  const homes = new Set(state.vehicles.filter(v => v.owner === 'player' && v.orders.includes(gig.id)).map(v => v.homeCityId));
  const depots = state.depots.filter(d => homes.has(d.cityId));
  const picks = gig.crewPicks ?? [];
  const named = picks.map(id => state.people.find(m => m.id === id)).filter((m): m is CrewMember => !!m);
  const act = (ids: string[]) => {
    const r = ctx.dispatch(s => setCrewPicks(s, gig.id, ids));
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const evaluation = named.length ? evaluateCrew(named, gig) : null;
  // People named for other shows are spoken for.
  const elsewhere = new Map<string, string>();
  state.gigs.forEach(g => g.id !== gig.id && g.status === 'booked' && (g.crewPicks ?? []).forEach(id => elsewhere.set(id, g.act)));
  if (!depots.length) return <div className="tt-dim">Assign a vehicle to choose who goes.</div>;
  const pool = state.people.filter(m => m.depotId && depots.some(d => d.id === m.depotId)).sort((a, b) => levelOf(b) - levelOf(a) || a.name.localeCompare(b.name));
  return (
    <div>
      <div className="tt-dim" style={{ marginBottom: 4, whiteSpace: 'normal' }}>
        {named.length}/{gig.crewNeeded} named{evaluation ? ` · fit ${Math.round(evaluation.match * 100)}%` : ' — the rest are picked automatically'}.{' '}
        {named.length > 0 && (
          <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => act([])}>
            Back to automatic
          </a>
        )}
      </div>
      <div className="tt-list">
        {pool.map(m => {
          const on = picks.includes(m.id);
          const other = elsewhere.get(m.id);
          return (
            <PersonRow
              key={m.id}
              state={state}
              m={m}
              right={
                other && !on ? (
                  <span className="tt-dim" title={`Named for ${other}`} style={{ fontSize: 11 }}>
                    on {other.length > 12 ? `${other.slice(0, 11)}…` : other}
                  </span>
                ) : (
                  <button
                    className={`tt-btn sm${on ? ' primary' : ''}`}
                    disabled={!on && picks.length >= gig.crewNeeded}
                    onClick={() => act(on ? picks.filter(id => id !== m.id) : [...picks, m.id])}
                  >
                    {on ? '✓ Going' : 'Send'}
                  </button>
                )
              }
            />
          );
        })}
        {!pool.length && <div className="tt-dim">Nobody at the base right now.</div>}
      </div>
    </div>
  );
}

export function CrewWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const [tab, setTab] = useState<'roster' | 'hire'>('roster');
  const world = worldOf(state);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const pay = PAY[state.policies.pay].wage;
  const payroll = Math.round(state.people.reduce((sum, m) => sum + dayRate(m), 0) * pay);
  const byLevel = (a: CrewMember, b: CrewMember) => levelOf(b) - levelOf(a) || a.name.localeCompare(b.name);
  const cityOf = (depotId?: string) => world.cityById.get(state.depots.find(d => d.id === depotId)?.cityId ?? '')?.name ?? '?';
  const onRoad = state.vehicles.filter(v => v.owner === 'player' && state.people.some(m => m.vehicleId === v.id));

  return (
    <div>
      <div className="tt-tabs">
        <button className="tt-btn sm" data-on={tab === 'roster'} onClick={() => setTab('roster')}>
          Roster ({state.people.length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'hire'} onClick={() => setTab('hire')}>
          Hiring ({state.candidates.length})
        </button>
      </div>
      {state.poachBids.map(b => {
        const m = state.people.find(p => p.id === b.personId);
        if (!m) return null;
        const days = Math.max(0, b.expiresDay - Math.floor(state.hour / 24));
        return (
          <div key={b.id} className="tt-item" style={{ background: 'rgba(239,68,68,0.15)', gap: 6, flexWrap: 'wrap' }}>
            <span className="grow" style={{ whiteSpace: 'normal' }}>
              <b>{b.rivalName}</b> want <b>{m.name}</b> ({levelOf(m)}★ {roleOf(m)}) at +{Math.round(b.raise * 100)}%.{' '}
              <span className="tt-dim">{days ? `${days} days to answer.` : 'Leaving once back at base.'}</span>
            </span>
            <button className="tt-btn sm primary" onClick={() => act(s => answerPoach(s, b.id, true))}>
              Match ({money(Math.round(dayRate(m) * (1 + b.raise) * pay))}/day)
            </button>
            <button className="tt-btn sm" onClick={() => act(s => answerPoach(s, b.id, false))}>
              Let go
            </button>
          </div>
        );
      })}
      <Stat label="Payroll">{money(payroll)}/day</Stat>
      <Stat label="By department">
        {CREW_DEPTS.map(d => `${CREW_DEPT_LABEL[d]} ${state.people.filter(m => m.primary === d).length}`).join(' · ')}
      </Stat>

      {tab === 'roster' ? (
        <>
          {state.depots.map(d => {
            const here = state.people.filter(m => m.depotId === d.id).sort(byLevel);
            const trucks = state.vehicles.filter(v => v.owner === 'player' && v.homeCityId === d.cityId);
            return (
              <div key={d.id}>
                <h4>
                  At base — {cityOf(d.id)} ({here.length})
                </h4>
                <div className="tt-list">
                  {here.map(m => (
                    <PersonRow
                      key={m.id}
                      state={state}
                      m={m}
                      right={
                        <>
                          {trucks.length > 0 && (
                            <select
                              className="tt-input"
                              aria-label={`Pin ${m.name} to a truck`}
                              value={m.pinnedVehicleId ?? ''}
                              onChange={e => act(s => pinCrew(s, m.id, e.target.value || undefined))}
                              style={{ maxWidth: 110 }}
                            >
                              <option value="">Any truck</option>
                              {trucks.map(v => (
                                <option key={v.id} value={v.id}>
                                  📌 {v.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <button className="tt-btn sm" title="Let go" onClick={() => window.confirm(`Let ${m.name} go?`) && act(s => fireMember(s, m.id))}>
                            ✕
                          </button>
                        </>
                      }
                    />
                  ))}
                  {!here.length && <div className="tt-dim">Nobody at base.</div>}
                </div>
              </div>
            );
          })}
          {onRoad.map(v => (
            <div key={v.id}>
              <h4 style={{ cursor: 'pointer' }} onClick={() => ctx.open('vehicle', v.id)}>
                On the road — {v.name} ›
              </h4>
              <div className="tt-list">
                {state.people
                  .filter(m => m.vehicleId === v.id)
                  .sort(byLevel)
                  .map(m => (
                    <PersonRow key={m.id} state={state} m={m} />
                  ))}
              </div>
            </div>
          ))}
          <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
            Shows split their crew slots by what they need — a lighting-heavy show wants LX techs — and the best-matched, freshest
            people get on the truck. Pin someone to a truck to make them its regular: they always ride it. Everyone levels up in the
            department they work (and wants paying for it). Keep morale up or rivals come knocking for your stars.
          </div>
        </>
      ) : (
        <>
          {state.depots.map(d => {
            const pool = state.candidates.filter(c => c.depotId === d.id).sort(byLevel);
            return (
              <div key={d.id}>
                <h4>Looking for work near {cityOf(d.id)}</h4>
                <div className="tt-list">
                  {pool.map(c => (
                    <PersonRow
                      key={c.id}
                      state={state}
                      m={c}
                      right={
                        <button className="tt-btn sm primary" disabled={state.company.cash < hireFee(c)} onClick={() => act(s => hireCandidate(s, c.id))}>
                          Sign {money(hireFee(c))}
                        </button>
                      }
                    />
                  ))}
                  <div className="tt-item">
                    <span className="grow tt-dim">Or take on a green 1★ tech, no questions asked.</span>
                    <button className="tt-btn sm" onClick={() => act(s => hireCrew(s, d.id))}>
                      {money(CREW_HIRE_COST)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
            New faces every month. Stars are rare — and come more often to a company with a name.
          </div>
        </>
      )}
    </div>
  );
}
