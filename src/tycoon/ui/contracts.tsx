import { breakContract, signContract } from '@/world/actions';
import { DEPT_LABELS, tierInfo } from '@/world/catalog';
import { BREAK_MONTHS, contractShortfall } from '@/world/contracts';
import { dayOf, formatDay } from '@/world/core';
import { deptTotals } from '@/world/loading';
import { worldOf } from '@/world/mapgen';
import { DEPTS, type VenueContract } from '@/world/types';
import { DeptDot, Stat, TierChip } from './bits';
import { money } from './format';
import type { WinCtx } from './types';

export function ContractCard({ ctx, c }: { ctx: WinCtx; c: VenueContract }) {
  const { state } = ctx;
  const world = worldOf(state);
  const venue = world.venueById.get(c.venueId);
  const city = world.cityById.get(c.cityId);
  const today = dayOf(state.hour);
  const rival = state.rivals.find(r => r.id === c.rivalId);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const locked = state.company.reputation < tierInfo(c.tier).minReputation;
  const short = c.status === 'offer' ? contractShortfall(state, c) : null;
  const installed = deptTotals(c.installed);
  return (
    <div className="tt-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <div className="tt-row">
        <a style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => venue && ctx.open('venue', venue.id)}>
          🏛 {venue?.name}, {city?.name}
        </a>
        <TierChip tier={c.tier} locked={c.status === 'offer' && locked} />
      </div>
      <Stat label="Retainer">
        <b>{money(c.monthly)}</b>/month × 12
      </Stat>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {DEPTS.filter(d => c.kit[d] > 0).map(d => (
          <span key={d} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <DeptDot dept={d} /> {c.status === 'active' ? `${installed[d]}/` : ''}
            {c.kit[d]} {DEPT_LABELS[d]}
          </span>
        ))}
      </div>
      {c.status === 'offer' && (
        <>
          <div className="tt-dim">
            Starts {formatDay(state, c.startDay)} · bids close in {c.acceptByDay - today}d
          </div>
          {locked ? (
            <div className="tt-warn">The venue wants reputation {tierInfo(c.tier).minReputation}+.</div>
          ) : !short ? (
            <div className="tt-warn">Needs a warehouse in {city?.name} to supply the house rig.</div>
          ) : DEPTS.some(d => short[d] > 0) ? (
            <div className="tt-warn">
              Your {city?.name} warehouse is short:{' '}
              {DEPTS.filter(d => short[d] > 0)
                .map(d => `${short[d]} ${DEPT_LABELS[d]}`)
                .join(', ')}
              .
            </div>
          ) : (
            <button className="tt-btn primary" onClick={() => act(s => signContract(s, c.id))}>
              Sign — install the rig
            </button>
          )}
        </>
      )}
      {c.status === 'active' && (
        <div className="tt-row">
          <span className="tt-good">Yours until {formatDay(state, c.endDay)}</span>
          <button className="tt-btn sm" title={`Penalty ${money(c.monthly * BREAK_MONTHS)}`} onClick={() => act(s => breakContract(s, c.id))}>
            Pull out
          </button>
        </div>
      )}
      {c.status === 'rival' && <div className="tt-dim">House supplier: {rival?.name ?? 'a rival'} until {formatDay(state, c.endDay)}</div>}
    </div>
  );
}

export function ContractList({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const today = dayOf(state.hour);
  const mine = state.contracts.filter(c => c.status === 'active');
  const open = state.contracts.filter(c => c.status === 'offer' && c.acceptByDay >= today).sort((a, b) => a.acceptByDay - b.acceptByDay);
  return (
    <div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
        Venues tender a year as their house PA & lighting supplier. Sign one and the rig is installed from your warehouse in that
        town for the year, earning a monthly retainer. Shows at that venue run on the house rig — your trucks only bring the rest
        — and rivals can't take them.
      </div>
      <h4>Your contracts</h4>
      <div className="tt-list">
        {mine.map(c => (
          <ContractCard key={c.id} ctx={ctx} c={c} />
        ))}
        {!mine.length && <div className="tt-dim">None yet.</div>}
      </div>
      <h4>Open tenders</h4>
      <div className="tt-list">
        {open.map(c => (
          <ContractCard key={c.id} ctx={ctx} c={c} />
        ))}
        {!open.length && <div className="tt-dim">No venues are tendering right now — watch the news.</div>}
      </div>
    </div>
  );
}
