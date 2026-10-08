import { setPolicy } from '@/world/actions';
import { WORKSHOP, WORKSHOP_LEVELS, averageCondition, monthlyWorkshopCost, ownedStock } from '@/world/wear';
import { Bar, FatigueChip, Stat } from './bits';
import { CREW_WAGE_PER_DAY } from '@/world/catalog';
import { FREELANCE_DAY_RATE, PAY, PAY_LEVELS, averageFatigue, moraleTarget } from '@/world/crew';
import { ConditionChip } from './gear';
import { SUBHIRE_DAY_RATE, rentOutMonthly } from '@/world/hire';
import { INSURANCE, INSURANCE_LEVELS, insuredValue, monthlyPremium } from '@/world/incidents';
import { money } from './format';
import type { WinCtx } from './types';

/** A row of mutually exclusive options, TT-style. */
export function Choice<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: { id: T; label: string; detail: string; note?: string }[];
  onPick: (id: T) => void;
}) {
  return (
    <div className="tt-list">
      {options.map(o => (
        <button
          key={o.id}
          className="tt-item clickable"
          data-on={o.id === value}
          style={{ textAlign: 'left', border: o.id === value ? '1px solid var(--tt-accent, #facc15)' : undefined }}
          onClick={() => onPick(o.id)}
        >
          <div className="grow">
            <div style={{ fontWeight: 700 }}>
              {o.id === value ? '● ' : '○ '}
              {o.label}
            </div>
            <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
              {o.detail}
            </div>
          </div>
          {o.note && <b style={{ whiteSpace: 'nowrap' }}>{o.note}</b>}
        </button>
      ))}
    </div>
  );
}

export function PoliciesWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const set = <K extends 'workshop' | 'pay' | 'insurance' | 'freelance' | 'subhire' | 'rentOut'>(key: K, value: (typeof state.policies)[K]) => ctx.dispatch(s => setPolicy(s, key, value));
  const owned = ownedStock(state);
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Gear workshop</h4>
      <Stat label="Average condition of your kit">
        <ConditionChip value={averageCondition(state, owned)} />
      </Stat>
      <Choice
        value={state.policies.workshop}
        options={WORKSHOP_LEVELS.map(id => ({
          id,
          label: WORKSHOP[id].label,
          detail: WORKSHOP[id].blurb,
          note: `${money(monthlyWorkshopCost(state, id))}/mo`,
        }))}
        onPick={id => set('workshop', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Every show wears the kit it uses — festivals and world tours most. Worn kit performs worse, sells for less and is far
        likelier to die mid-set. Refurbish a whole product line with 🔧 in a warehouse.
      </div>

      <h4>Crew pay & morale</h4>
      <div className="tt-row">
        <span className="tt-dim">Morale</span>
        <span>
          <b>{Math.round(state.crewMorale)}</b> <span className="tt-dim">→ {Math.round(moraleTarget(state))}</span>
        </span>
      </div>
      <Bar value={state.crewMorale} max={100} color={state.crewMorale >= 60 ? '#22c55e' : state.crewMorale >= 40 ? '#f59e0b' : '#ef4444'} />
      <Stat label="How tired the crews are">
        <FatigueChip value={averageFatigue(state)} />
      </Stat>
      <Choice
        value={state.policies.pay}
        options={PAY_LEVELS.map(id => ({
          id,
          label: PAY[id].label,
          detail: PAY[id].blurb,
          note: `${money(CREW_WAGE_PER_DAY * PAY[id].wage)}/day`,
        }))}
        onPick={id => set('pay', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Days on the road tire crews out (tours and festivals most) and tired crews build worse shows; they recover at home.
        Morale drifts each month towards what you pay, less how worn out everyone is. Good morale lifts every show; below 40,
        people start quitting.
      </div>

      <h4>Local freelancers</h4>
      <Choice
        value={state.policies.freelance}
        options={[
          {
            id: 'fill' as const,
            label: 'Fill crew gaps locally',
            detail: 'Short-handed shows hire local freelancers at the venue — cheaper and better where you have a base.',
            note: `${money(FREELANCE_DAY_RATE)}/day`,
          },
          { id: 'off' as const, label: 'Own crew only', detail: 'Never hire in: short-handed shows play short.' },
        ]}
        onPick={id => set('freelance', id)}
      />

      <h4>Rental market</h4>
      <Choice
        value={state.policies.subhire}
        options={[
          {
            id: 'fill' as const,
            label: 'Sub-hire shortfalls',
            detail: 'Short of kit for a show? A rival with a base nearby delivers the rest to the venue, at a day rate.',
            note: `${Math.round(SUBHIRE_DAY_RATE * 100)}%/day`,
          },
          { id: 'off' as const, label: 'Own kit only', detail: 'Never rent in: short shows play short.' },
        ]}
        onPick={id => set('subhire', id)}
      />
      <div style={{ height: 6 }} />
      <Choice
        value={state.policies.rentOut}
        options={[
          { id: 'off' as const, label: 'Keep idle kit home', detail: 'Nothing rented out; no extra wear.' },
          {
            id: 'on' as const,
            label: 'Rent idle kit out',
            detail: 'Dry-hire what’s on the racks between your own jobs — income, but extra wear.',
            note: `≈${money(rentOutMonthly(state))}/mo`,
          },
        ]}
        onPick={id => set('rentOut', id)}
      />

      <h4>Insurance</h4>
      <Stat label="Insured value (gear + fleet)">{money(insuredValue(state))}</Stat>
      <Choice
        value={state.policies.insurance}
        options={INSURANCE_LEVELS.map(id => ({
          id,
          label: INSURANCE[id].label,
          detail: INSURANCE[id].blurb,
          note: `${money(monthlyPremium(state, id))}/mo`,
        }))}
        onPick={id => set('insurance', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Warehouses get broken into, trucks crash, and outdoor festivals get rained on — British summers most of all.
      </div>
    </div>
  );
}
