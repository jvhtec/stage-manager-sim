import { fireCrew, fireStaff, hireCrew, hireStaff, upgradeDepot } from '@/world/actions';
import { CREW_HIRE_COST, STAFF_HIRE_COST } from '@/world/catalog';
import { crewWage, PAY } from '@/world/crew';
import { STAFF, STAFF_ROLES, facilitySpec, monthlyRent, nextUpgrade, prepRatio, salesBoost, usedCapacity } from '@/world/facilities';
import { worldOf } from '@/world/mapgen';
import type { Depot } from '@/world/types';
import { Bar, FatigueChip, Stat } from './bits';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

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
  const techs = Math.round(depot.crew * crewWage(state) * 30);
  const prep = prepRatio(state, depot);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (!r.ok || r.message) ctx.toast(r.message ?? 'Done', r.ok);
  };
  return (
    <div>
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

      <h4>Gig technicians on the payroll</h4>
      <div className="tt-item">
        <span className="grow">
          {depot.crew} based here <span className="tt-dim">· {money(crewWage(state))}/day each</span>{' '}
          {depot.crew > 0 && <FatigueChip value={depot.fatigue ?? 0} />}
        </span>
        <button className="tt-btn sm" onClick={() => act(s => fireCrew(s, depot.id))}>
          −
        </button>
        <button className="tt-btn sm" onClick={() => act(s => hireCrew(s, depot.id))}>
          Hire {money(CREW_HIRE_COST)}
        </button>
      </div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginTop: 2 }}>
        Gig techs go on the road with the trucks; full-time staff stay at the base. Short-handed shows can be topped up with
        local freelancers (Policies).
      </div>

      <h4>Monthly costs</h4>
      <Stat label="Rent, rates & utilities">{money(rent)}</Stat>
      <Stat label="Full-time salaries">{money(salaries)}</Stat>
      <Stat label="Gig techs (≈30 days)">{money(techs)}</Stat>
      <Stat label="Total">
        <b>{money(rent + salaries + techs)}</b>
      </Stat>
    </div>
  );
}
