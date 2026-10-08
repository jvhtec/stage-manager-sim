import { bidEvent } from '@/world/actions';
import { DEPT_COLORS, DEPT_LABELS, tierInfo } from '@/world/catalog';
import { dayOf, formatDay } from '@/world/core';
import { BID_LEVELS, BID_LEVEL_IDS, EVENT_PRESTIGE, EVENT_REPUTATION, eventCalendar } from '@/world/events';
import { worldOf } from '@/world/mapgen';
import { eventTitle } from '@/world/content/events';
import { gigBookingBar } from '@/world/standing';
import type { Gig } from '@/world/types';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

const SCALE_LABEL: Record<number, string> = { 3: 'Arena scale', 4: 'Stadium scale', 5: 'Historic' };

/** Who holds a lot, or where its tender stands. */
function lotStatus(ctx: WinCtx, g: Gig): { text: string; cls: string } {
  const { state } = ctx;
  const today = dayOf(state.hour);
  if (g.status === 'offer') {
    if (g.acceptByDay < today) return { text: 'deciding…', cls: 'tt-dim' };
    return g.bid ? { text: `your ${BID_LEVELS[g.bid].label.toLowerCase()} bid is in`, cls: 'tt-good' } : { text: 'open for bids', cls: 'tt-warn' };
  }
  if (g.status === 'booked') return { text: 'yours — assign trucks', cls: 'tt-good' };
  if (g.status === 'done') return { text: `you delivered (${Math.round((g.result?.quality ?? 0) * 100)}%)`, cls: 'tt-good' };
  if (g.status === 'failed') return { text: 'you failed it', cls: 'tt-bad' };
  if (g.status === 'rival') return { text: state.rivals.find(r => r.id === g.rivalId)?.name ?? 'a rival', cls: 'tt-dim' };
  return { text: 'nobody', cls: 'tt-dim' };
}

export function EventList({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const today = dayOf(state.hour);
  const dates = eventCalendar(state, worldOf(state));
  return (
    <div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
        The nights the industry talks about. Each production is tendered department by department; put in a sealed bid and the
        best value wins each lot when bidding closes. Live broadcasts tolerate nothing late or broken — and a great night is
        worth a year of reputation.
      </div>
      <div className="tt-list">
        {dates.map(d => {
          const citywide = d.event.kind === 'citywide';
          return (
            <div key={`${d.event.id}-${d.year}`} className="tt-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 3 }}>
              <div className="tt-row">
                <b style={{ whiteSpace: 'normal' }}>
                  {citywide ? '🎉' : d.event.broadcast ? '📺' : '★'} {eventTitle(d.event, d.year)}
                </b>
                <span className="tt-chip" style={{ background: d.event.scale === 5 ? '#facc15' : tierInfo(Math.min(4, d.event.scale)).color }}>
                  {citywide ? 'Citywide' : SCALE_LABEL[d.event.scale]}
                </span>
              </div>
              <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                {formatDay(state, d.startDay)}
                {(d.event.days ?? 1) > 1 ? ` (${d.event.days} days)` : ''} · {d.host}
                {d.event.bill ? ` · ${d.event.bill}` : ''}
              </div>
              {citywide ? (
                <div className="tt-dim">{d.lots.length ? `${d.lots.length} extra shows on the day — see Offers.` : 'Shows announced a month before.'}</div>
              ) : d.lots.length ? (
                d.lots.map(g => {
                  const st = lotStatus(ctx, g);
                  return (
                    <div key={g.id} className="tt-row clickable" style={{ cursor: 'pointer' }} onClick={() => ctx.open('gig', g.id)}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: DEPT_COLORS[g.event!.lot], display: 'inline-block' }} />
                        {DEPT_LABELS[g.event!.lot]} <span className="tt-dim">{kmoney(g.fee)}</span>
                      </span>
                      <span className={st.cls}>{st.text} ›</span>
                    </div>
                  );
                })
              ) : (
                <div className="tt-dim">
                  {today < d.closeDay ? `Tender opens soon — organisers want reputation ${EVENT_REPUTATION[d.event.scale]}+.` : 'Tender closed.'}
                </div>
              )}
            </div>
          );
        })}
        {!dates.length && <div className="tt-dim">Nothing on the horizon this year.</div>}
      </div>
    </div>
  );
}

/** Sealed-bid controls for an event lot (replaces the Book button). */
export function EventBid({ ctx, gig }: { ctx: WinCtx; gig: Gig }) {
  const { state } = ctx;
  const ev = gig.event!;
  const lock = gigBookingBar(state, gig).reason;
  const act = (level: (typeof BID_LEVEL_IDS)[number] | null) => {
    const r = ctx.dispatch(s => bidEvent(s, gig.id, level));
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const contenders = state.rivals.filter(r => r.maxTier >= gig.tier && r.reputation >= EVENT_REPUTATION[ev.scale as 3 | 4 | 5] - 15);
  return (
    <div style={{ marginTop: 10 }}>
      {ev.broadcast && (
        <div className="tt-warn" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
          📺 Live broadcast: anything late, missing or failing costs dearly.
        </div>
      )}
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
        Sealed bids close {formatDay(state, gig.acceptByDay)}. {contenders.length} rival{contenders.length === 1 ? '' : 's'} in contention
        {contenders.length ? ` (${contenders.slice(0, 3).map(r => r.name).join(', ')}${contenders.length > 3 ? '…' : ''})` : ''}. A great night:
        +{EVENT_PRESTIGE[ev.scale as 3 | 4 | 5]} reputation.
      </div>
      {lock ? (
        <div className="tt-warn">
          {lock} You have {Math.round(state.company.reputation)}.
        </div>
      ) : (
        <div className="tt-list">
          {BID_LEVEL_IDS.map(id => (
            <button
              key={id}
              className="tt-item clickable"
              style={{ textAlign: 'left', border: gig.bid === id ? '1px solid var(--tt-accent, #facc15)' : undefined }}
              onClick={() => act(id)}
            >
              <div className="grow">
                <div style={{ fontWeight: 700 }}>
                  {gig.bid === id ? '● ' : '○ '}
                  {BID_LEVELS[id].label}
                </div>
                <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                  {BID_LEVELS[id].blurb}
                </div>
              </div>
              <b>{money(Math.round((gig.fee * BID_LEVELS[id].price) / 50) * 50)}</b>
            </button>
          ))}
          {gig.bid && (
            <button className="tt-btn sm" onClick={() => act(null)}>
              Withdraw bid
            </button>
          )}
        </div>
      )}
    </div>
  );
}
