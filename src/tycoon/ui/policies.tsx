import { setPolicy } from '@/world/actions';
import { WORKSHOP, WORKSHOP_LEVELS, averageCondition, monthlyWorkshopCost, ownedStock } from '@/world/wear';
import { Stat } from './bits';
import { ConditionChip } from './gear';
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
  const set = <K extends 'workshop' | 'pay' | 'insurance'>(key: K, value: (typeof state.policies)[K]) => ctx.dispatch(s => setPolicy(s, key, value));
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
    </div>
  );
}
