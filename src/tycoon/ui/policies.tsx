import { INVOICING, INVOICING_LEVELS } from '@/world/receivables';
import { setPartner, setPolicy } from '@/world/actions';
import { PARTNER_DISCOUNT, PARTNER_REPUTATION, PARTNER_SHARE, brandShare, brandsFor, sponsorship } from '@/world/partners';
import { DEPT_LABELS } from '@/world/catalog';
import { DEPTS } from '@/world/types';
import { REST_AT } from '@/world/people';
import { MARKETING, MARKETING_LEVELS, marketingMonthly } from '@/world/marketing';
import { dayOf, formatDay } from '@/world/core';
import { WORKSHOP, WORKSHOP_LEVELS, averageCondition, monthlyWorkshopCost, ownedStock } from '@/world/wear';
import { Bar, ExperienceChip, FatigueChip, Stat } from './bits';
import { CREW_WAGE_PER_DAY } from '@/world/catalog';
import { FREELANCE_DAY_RATE, PAY, PAY_LEVELS, TRAINING, TRAINING_LEVELS, averageExperience, averageFatigue, moraleTarget } from '@/world/crew';
import { ConditionChip } from './gear';
import { SUBHIRE_DAY_RATE, rentOutMonthly } from '@/world/hire';
import { INSURANCE, INSURANCE_LEVELS, insuredValue, monthlyPremium } from '@/world/incidents';
import { money } from './format';
import type { WinCtx } from './types';

/** A row of mutually exclusive options, TT-style. */
const REST_ROTAS = ['off', 'tired', 'strict'] as const;
const REST_LABEL = {
  off: { label: 'Everyone works', blurb: 'Whoever fits the job best goes, however tired.' },
  tired: { label: `Rest the exhausted`, blurb: `Fatigue ${REST_AT.tired}+ stays home.` },
  strict: { label: 'Strict rota', blurb: `Fatigue ${REST_AT.strict}+ stays home.` },
};

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
  const set = <K extends 'workshop' | 'pay' | 'insurance' | 'freelance' | 'subhire' | 'rentOut' | 'training' | 'rest' | 'marketing' | 'rehearsal' | 'invoicing'>(key: K, value: (typeof state.policies)[K]) => ctx.dispatch(s => setPolicy(s, key, value));
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
        Morale drifts each month towards what you pay, less how worn out everyone is. Good morale lifts every show; below 50,
        rivals make offers to your 3★+ people (match them in the crew window); below 40, people start quitting.
      </div>

      <h4>Rest rota</h4>
      <Choice
        value={state.policies.rest}
        options={REST_ROTAS.map(id => ({ id, label: REST_LABEL[id].label, detail: REST_LABEL[id].blurb }))}
        onPick={id => set('rest', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Resting people stay at base when a truck loads — fresher crews and better morale, but more seats filled by freelancers.
        People pinned to a truck always go.
      </div>

      <h4>Invoices</h4>
      <Choice
        value={state.policies.invoicing}
        options={INVOICING_LEVELS.map(id => ({ id, label: INVOICING[id].label, detail: INVOICING[id].blurb }))}
        onPick={id => set('invoicing', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Clubs and pubs pay on the night; arenas take about a month and stadiums and festivals longer. A promoter sometimes goes under owing you —
        more often in a downturn.
      </div>

      <h4>Rehearsals</h4>
      <Choice
        value={state.policies.rehearsal}
        options={[
          { id: 'manual', label: 'Manual', detail: 'You book each rehearsal yourself. A reminder arrives a week out.' },
          { id: 'auto', label: 'Automatic', detail: 'Required rehearsals are booked for you in the fortnight before the first date, if the stage is free and you can pay.' },
        ]}
        onPick={id => set('rehearsal', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Arena and stadium shows, broadcast events and tours need a rehearsal stage (Base → Annexes) to book, and have to go through it
        before the first date: an unrehearsed show loses 10% quality and fails 30% more often.
      </div>

      <h4>Crew training</h4>
      <Stat label="Crew experience">
        <ExperienceChip value={averageExperience(state)} />
      </Stat>
      <Choice
        value={state.policies.training}
        options={TRAINING_LEVELS.map(id => ({
          id,
          label: TRAINING[id].label,
          detail: TRAINING[id].blurb,
          note: TRAINING[id].perCrewMonth ? `${money(TRAINING[id].perCrewMonth)}/crew/mo` : undefined,
        }))}
        onPick={id => set('training', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Crews get better with every show (big ones teach more) and work up to 15% better when seasoned — new hires start green
        and dilute it.
      </div>

      <h4>Marketing</h4>
      <Choice
        value={state.policies.marketing}
        options={MARKETING_LEVELS.map(id => ({
          id,
          label: MARKETING[id].label,
          detail: MARKETING[id].blurb,
          note: MARKETING[id].rate ? `${money(marketingMonthly(state, id))}/mo` : undefined,
        }))}
        onPick={id => set('marketing', id)}
      />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        More offers ({Math.round((MARKETING[state.policies.marketing].offers - 1) * 100)}% now) and a slow climb in reputation. The cost
        scales with your standing, and the trade-show season (PLASA, Prolight + Sound, LDI) asks you each year whether to exhibit.
        {state.promo && state.promo.offerUntil >= dayOf(state.hour) && (
          <>
            {' '}
            <b>Show buzz:</b> +{Math.round((state.promo.offerMult - 1) * 100)}% offers until {formatDay(state, state.promo.offerUntil)}
            {state.promo.gearUntil >= dayOf(state.hour) ? `, ${Math.round(state.promo.gearDiscount * 100)}% off kit until ${formatDay(state, state.promo.gearUntil)}` : ''}.
          </>
        )}
      </div>

      <h4>Maker partnerships</h4>
      {DEPTS.map(d => {
        const partner = state.partners[d];
        const brands = brandsFor(state, d);
        return (
          <div key={d} className="tt-item" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span style={{ width: 70 }}>{DEPT_LABELS[d]}</span>
            <select
              className="tt-input"
              aria-label={`${DEPT_LABELS[d]} partner`}
              value={partner?.brand ?? ''}
              onChange={e => {
                const r = ctx.dispatch(s => setPartner(s, d, e.target.value || undefined));
                if (r.message) ctx.toast(r.message, r.ok);
              }}
              style={{ flex: 1, minWidth: 120 }}
            >
              <option value="">No partner</option>
              {brands.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {partner && (
              <span className="tt-dim" style={{ width: '100%', whiteSpace: 'normal' }}>
                Your racks: {Math.round(brandShare(state, d, partner.brand) * 100)}% {partner.brand}
                {brandShare(state, d, partner.brand) >= PARTNER_SHARE ? ` · sponsorship ${money(sponsorship(state, d))}/month` : ` · below ${Math.round(PARTNER_SHARE * 100)}% — no sponsorship${partner.lapse ? `, ${partner.lapse} month${partner.lapse > 1 ? 's' : ''} of warnings` : ''}`}
              </span>
            )}
          </div>
        );
      })}
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Commit a department to one maker (reputation {PARTNER_REPUTATION}+): {Math.round(PARTNER_DISCOUNT * 100)}% off their kit, and a monthly sponsorship while
        {' '}{Math.round(PARTNER_SHARE * 100)}%+ of that department's racks wear their name. Let the share slip and they walk; a partner can't be swapped for a year.
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
