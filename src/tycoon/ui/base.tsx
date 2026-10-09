import { buildAnnex, fireStaff, hireCrew, hireStaff, rehearseShow, trainCrew, upgradeDepot } from '@/world/actions';
import {
  MODULES,
  MODULE_IDS,
  REHEARSAL_FAILURE,
  REHEARSAL_QUALITY,
  annexUpkeep,
  gigRehearsalCost,
  moduleBlocker,
  moduleLevel,
  modLevel,
  rehearsable,
  rehearsalBlocker,
  stageRental,
  tourLegs,
  tourRehearsalCost,
} from '@/world/annexes';
import { dayOf, formatDay } from '@/world/core';
import { dayRate, levelOf } from '@/world/people';
import { PersonRow } from './crewWindow';
import { CREW_HIRE_COST, STAFF_HIRE_COST } from '@/world/catalog';
import { PAY } from '@/world/crew';
import { STAFF, STAFF_ROLES, facilitySpec, monthlyRent, nextUpgrade, prepRatio, salesBoost, usedCapacity } from '@/world/facilities';
import { worldOf } from '@/world/mapgen';
import type { Depot } from '@/world/types';
import { Bar, Stat } from './bits';
import { kmoney, money } from './format';
import type { WinCtx } from './types';
import { BaseDiorama } from './scenes';

/** The base at a glance: what it is, what it costs, who works there. */
export function BaseOverview({ ctx, depot }: { ctx: WinCtx; depot: Depot }) {
  const { state } = ctx;
  const world = worldOf(state);
  const spec = facilitySpec(depot);
  const used = usedCapacity(state, depot);
  const next = nextUpgrade(depot);
  const pay = PAY[state.policies.pay].wage;
  const salaries = Math.round((depot.staff.warehouse * STAFF.warehouse.salary + depot.staff.office * STAFF.office.salary) * pay);
  const rent = monthlyRent(world, depot);
  const here = state.people.filter(m => m.depotId === depot.id).sort((a, b) => levelOf(b) - levelOf(a));
  const techs = Math.round(here.reduce((sum, m) => sum + dayRate(m), 0) * pay * 30);
  const prep = prepRatio(state, depot);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (!r.ok || r.message) ctx.toast(r.message ?? 'Done', r.ok);
  };
  return (
    <div>
      <BaseDiorama state={state} depot={depot} />
      <div className="tt-row">
        <b>
          {depot.kind === 'delegation' ? '🏢' : '🏭'} {spec.label}
        </b>
        <span className="tt-dim">{spec.vehicles === 'all' ? 'any vehicle' : 'vans & buses only'}</span>
      </div>
      <div className="tt-row">
        <span className="tt-dim">Storage</span>
        <span>
          {used}/{spec.capacity}
        </span>
      </div>
      <Bar value={used} max={spec.capacity} color={used > spec.capacity * 0.9 ? '#ef4444' : '#38bdf8'} />
      {next && (
        <div className="tt-item" style={{ marginTop: 6 }}>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Upgrade to {next.spec.label.toLowerCase()}</div>
            <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
              {next.spec.capacity} units, {next.spec.maxStaff.warehouse} prep / {next.spec.maxStaff.office} office staff
              {next.spec.minReputation > state.company.reputation ? ` · needs reputation ${next.spec.minReputation}` : ''}
            </div>
          </div>
          <button
            className="tt-btn sm primary"
            disabled={state.company.cash < next.cost || state.company.reputation < next.spec.minReputation}
            onClick={() => act(s => upgradeDepot(s, depot.id))}
          >
            {kmoney(next.cost)}
          </button>
        </div>
      )}

      <h4>Annexes</h4>
      {depot.kind === 'delegation' ? (
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
          Rehearsal stages, workshop benches and crew lounges need a warehouse — upgrade this delegation first.
        </div>
      ) : (
        <>
          {MODULE_IDS.map(id => {
            const level = modLevel(depot, id);
            const info = MODULES[id];
            const cur = moduleLevel(id, level);
            const next = moduleLevel(id, level + 1);
            const why = moduleBlocker(state, depot, id);
            return (
              <div key={id} className="tt-item">
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>
                    {info.icon} {cur ? cur.label : info.label}{' '}
                    <span className="tt-dim">{cur ? `· ${money(cur.upkeep)}/mo` : '· not built'}</span>
                  </div>
                  <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                    {(cur ?? next)?.blurb}
                    {id === 'rehearsal' && level > 0 && (
                      <>
                        {' '}
                        Shows rehearsed here: quality +{Math.round(REHEARSAL_QUALITY[level] * 100)}%, failures −{Math.round((1 - REHEARSAL_FAILURE[level]) * 100)}%. Rented to bands for about{' '}
                        {money(stageRental(state, depot))}/mo.
                      </>
                    )}
                  </div>
                  {next && why && <div className="tt-dim" style={{ fontSize: 11 }}>{why}</div>}
                </div>
                {next && (
                  <button className="tt-btn sm primary" disabled={!!why} title={`${next.label}: ${money(next.upkeep)}/mo upkeep`} onClick={() => act(s => buildAnnex(s, depot.id, id))}>
                    {level ? 'Upgrade' : 'Build'} {kmoney(next.build)}
                  </button>
                )}
              </div>
            );
          })}
          {modLevel(depot, 'rehearsal') > 0 && <RehearsalBooking ctx={ctx} />}
        </>
      )}

      <h4>Full-time staff</h4>
      {STAFF_ROLES.map(role => (
        <div key={role} className="tt-item">
          <div className="grow">
            <div style={{ fontWeight: 700 }}>
              {STAFF[role].label}{' '}
              <span className="tt-dim">
                {depot.staff[role]}/{spec.maxStaff[role]} · {money(Math.round(STAFF[role].salary * pay))}/mo each
              </span>
            </div>
            <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
              {role === 'warehouse'
                ? `Prep ${Math.round(prep * 100)}% — ${prep >= 1 ? 'every case checked before it goes out.' : prep >= 0.5 ? 'stretched: more failures on the night.' : 'kit goes out unchecked; cases get left behind.'}`
                : `Work from the region +${Math.round(salesBoost(state, world, depot.cityId) * 100)}%.`}
            </div>
          </div>
          <button className="tt-btn sm" disabled={!depot.staff[role]} onClick={() => act(s => fireStaff(s, depot.id, role))}>
            −
          </button>
          <button
            className="tt-btn sm"
            title={`Recruit for ${money(STAFF_HIRE_COST)}`}
            disabled={depot.staff[role] >= spec.maxStaff[role]}
            onClick={() => act(s => hireStaff(s, depot.id, role))}
          >
            +
          </button>
        </div>
      ))}

      <h4>Gig technicians at base ({here.length})</h4>
      <div className="tt-list">
        {here.map(m => (
          <PersonRow key={m.id} state={state} m={m} onTrain={c => act(s => trainCrew(s, m.id, c))} />
        ))}
        {!here.length && <div className="tt-dim">Nobody at base — they're all out on jobs, or you need to hire.</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button className="tt-btn sm" onClick={() => ctx.open('crew')}>
          Crew & hiring ›
        </button>
        <button className="tt-btn sm" onClick={() => act(s => hireCrew(s, depot.id))}>
          Quick-hire a green tech {money(CREW_HIRE_COST)}
        </button>
      </div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginTop: 2 }}>
        Gig techs go on the road with the trucks; full-time staff stay at the base. Short-handed shows can be topped up with
        local freelancers (Policies).
      </div>

      <h4>Monthly costs</h4>
      <Stat label="Rent, rates & utilities">{money(rent)}</Stat>
      <Stat label="Full-time salaries">{money(salaries)}</Stat>
      {annexUpkeep(depot) > 0 && <Stat label="Annex upkeep">{money(annexUpkeep(depot))}</Stat>}
      <Stat label="Gig techs (≈30 days)">{money(techs)}</Stat>
      <Stat label="Total">
        <b>{money(rent + salaries + techs + annexUpkeep(depot))}</b>
      </Stat>
    </div>
  );
}

/** Upcoming shows and tours that can still go through the stage. */
function RehearsalBooking({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const today = dayOf(state.hour);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const tourIds = new Set(state.tours.filter(t => t.status === 'booked' && tourLegs(state, t).length).map(t => t.id));
  const singles = state.gigs.filter(g => !g.tourId && rehearsable(state, g) && g.day - today <= 45).sort((a, b) => a.day - b.day);
  const tours = state.tours.filter(t => tourIds.has(t.id));
  if (!singles.length && !tours.length) {
    return <div className="tt-dim" style={{ marginTop: 4 }}>Nothing booked to rehearse. Book a show and come back.</div>;
  }
  return (
    <>
      <div className="tt-dim" style={{ marginTop: 6 }}>Book a rehearsal</div>
      <div className="tt-list">
        {tours.map(t => {
          const why = rehearsalBlocker(state, t.id);
          return (
            <div key={t.id} className="tt-item">
              <div className="grow">
                <div style={{ fontWeight: 700 }}>🎪 {t.name}</div>
                <div className="tt-dim">{tourLegs(state, t).length} dates still to play</div>
              </div>
              <button className="tt-btn sm" disabled={!!why} title={why ?? undefined} onClick={() => act(s => rehearseShow(s, t.id))}>
                Rehearse {money(tourRehearsalCost(state, t))}
              </button>
            </div>
          );
        })}
        {singles.slice(0, 6).map(g => {
          const why = rehearsalBlocker(state, g.id);
          return (
            <div key={g.id} className="tt-item">
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{g.act}</div>
                <div className="tt-dim">{formatDay(state, g.day)}</div>
              </div>
              <button className="tt-btn sm" disabled={!!why} title={why ?? undefined} onClick={() => act(s => rehearseShow(s, g.id))}>
                Rehearse {money(gigRehearsalCost(g))}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
