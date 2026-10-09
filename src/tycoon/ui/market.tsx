import { LOAN_MARGIN, marketNow, monthlyInterest } from '@/world/market';
import { SEASON, baseRate } from '@/world/content/economy';
import { ZONES } from '@/world/content/regulations';
import { dayOf, formatDay } from '@/world/core';
import { TENDER_CLOSES_DAYS, TENDER_OPENS_DAYS, festivalCalendar } from '@/world/festivals';
import { worldOf } from '@/world/mapgen';
import { WAR_WIN_BONUS } from '@/world/pricewars';
import type { Gig } from '@/world/types';
import { Bar, Stat, TierChip } from './bits';
import { money } from './format';
import type { WinCtx } from './types';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const pct = (x: number) => `${x >= 1 ? '+' : ''}${Math.round((x - 1) * 100)}%`;
const tone = (x: number) => (x >= 1.02 ? 'tt-good' : x <= 0.98 ? 'tt-bad' : '');

export function MarketWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const now = marketNow(state);
  const base = baseRate(state.country, now.year);
  const climate = now.periods.length ? now.periods : null;
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>The climate</h4>
      {climate ? (
        climate.map(p => (
          <div key={p.id} className={p.shutdown ? 'tt-warn' : 'tt-dim'} style={{ marginBottom: 4, whiteSpace: 'normal' }}>
            <b style={{ color: 'var(--tt-text, inherit)' }}>{p.label}.</b> {p.news}
          </div>
        ))
      ) : (
        <div className="tt-dim">A steady market — no booms or busts right now.</div>
      )}
      <Stat label="Shows on offer">
        <span className={tone(now.demand)}>{pct(now.demand)}</span>
      </Stat>
      <Stat label="Fees">
        <span className={tone(now.fees)}>{pct(now.fees)}</span>
      </Stat>

      {(state.priceWars ?? []).length > 0 && (
        <>
          <h4>Price wars</h4>
          <div className="tt-list">
            {state.priceWars.map(w => {
              const rival = state.rivals.find(r => r.id === w.rivalId);
              return (
                <div key={w.id} className="tt-item" style={{ gap: 6 }}>
                  <div className="grow" style={{ minWidth: 0, whiteSpace: 'normal' }}>
                    <b>{worldOf(state).cityById.get(w.cityId)?.name}</b> <span className="tt-dim">— {rival?.name ?? 'a rival'}</span>
                    <div className="tt-dim">
                      Fees −{Math.round(w.undercut * (w.fight ? 50 : 100))}%
                      {w.fight ? ' (you are fighting back)' : `, they win ${Math.round((WAR_WIN_BONUS - 1) * 100)}% more work`} · ends {formatDay(state, w.endDay)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h4>Low-emission zones</h4>
      {(ZONES[state.country] ?? []).length ? (
        <div className="tt-list">
          {(ZONES[state.country] ?? []).map(z => {
            const live = now.year >= z.from;
            return (
              <div key={`${z.name}-${z.from}`} className="tt-item" style={{ gap: 6, opacity: live ? 1 : 0.6 }}>
                <div className="grow" style={{ minWidth: 0, whiteSpace: 'normal' }}>
                  <b>{z.name}</b> <span className="tt-dim">— {z.cities.join(', ')}</span>
                  <div className="tt-dim">
                    {live ? 'In force' : `From ${z.from}`}: class {z.minClass}+ or {money(z.charge)} a day
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tt-dim">No low-emission zones in your market yet.</div>
      )}
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        A truck's emission class is what it met when it was built (1992 class 1 … 2014 class 6); a retrofit adds one. Check a
        vehicle's class in its window.
      </div>

      <h4>Season</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3, alignItems: 'end', height: 56 }}>
        {SEASON.map((v, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              title={`${pct(v)} work`}
              style={{
                width: '100%',
                height: Math.round(v * 30),
                background: i + 1 === now.month ? 'var(--tt-accent, #facc15)' : v >= 1.1 ? '#22c55e' : v < 0.9 ? '#64748b' : '#38bdf8',
                borderRadius: 2,
              }}
            />
            <span className="tt-dim" style={{ fontSize: 10 }}>
              {MONTHS[i]}
            </span>
          </div>
        ))}
      </div>
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Summer is festival season and pays best; January is dead. Have the trucks and crew ready by June, and keep cash in hand
        for the winter.
      </div>

      <h4>Festival season</h4>
      <FestivalCalendar ctx={ctx} />
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Festivals tender their stages two months out. Book one before the tender closes and it's yours — the rig is tied up for
        the whole festival, and it pays like a run of arena dates. Do it well and they'll ask for you next year.
      </div>

      <h4>Money</h4>
      <Stat label="Central bank rate">{base.toFixed(2)}%</Stat>
      <Stat label="Your loan rate">
        <b>{(now.loanRate * 100).toFixed(1)}%</b> <span className="tt-dim">(+{(LOAN_MARGIN * 100).toFixed(1)}%)</span>
      </Stat>
      <Bar value={now.loanRate} max={0.22} color={now.loanRate > 0.1 ? '#ef4444' : now.loanRate > 0.06 ? '#f59e0b' : '#22c55e'} />
      <Stat label="Interest this month">{money(monthlyInterest(state))}</Stat>
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Borrowing to expand is cheap some years and ruinous in others.
      </div>
    </div>
  );
}

export function FestivalCalendar({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const today = dayOf(state.hour);
  const dates = festivalCalendar(state, worldOf(state));
  if (!dates.length) return <div className="tt-dim">No festivals on the calendar yet in this era — they'll come.</div>;
  return (
    <div className="tt-list">
      {dates.map(d => {
        const main = d.gigs.find(g => g.festival?.main);
        const holder = (g?: Gig) =>
          !g ? null : g.status === 'booked' || g.status === 'done' ? 'You' : g.status === 'rival' ? state.rivals.find(r => r.id === g.rivalId)?.name ?? 'A rival' : null;
        const opens = d.startDay - TENDER_OPENS_DAYS;
        const closes = d.startDay - TENDER_CLOSES_DAYS;
        const status = d.gigs.length
          ? today <= closes && d.gigs.some(g => g.status === 'offer')
            ? `Tender open — closes in ${closes - today}d`
            : `Main stage: ${holder(main) ?? '—'}`
          : today < opens
            ? `Tender opens ${formatDay(state, opens)}`
            : 'Tender closed';
        return (
          <div
            key={`${d.festival.id}-${d.year}`}
            className={`tt-item${main ? ' clickable' : ''}`}
            onClick={() => main && ctx.open('gig', main.id)}
          >
            <div className="grow">
              <div style={{ fontWeight: 700 }}>
                🎪 {d.festival.name} {d.year}
              </div>
              <div className="tt-dim">
                {formatDay(state, d.startDay)} · {d.host.name} · {d.festival.days} day{d.festival.days > 1 ? 's' : ''}
              </div>
              <div className={d.gigs.some(g => g.status === 'offer') ? 'tt-good' : 'tt-dim'} style={{ fontSize: 11 }}>
                {status}
              </div>
            </div>
            <TierChip tier={d.size} />
          </div>
        );
      })}
    </div>
  );
}
