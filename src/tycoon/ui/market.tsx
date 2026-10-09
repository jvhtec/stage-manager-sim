import { useState } from 'react';
import { promoteFestival } from '@/world/actions';
import {
  FEST_HEADLINERS,
  FEST_HEADLINER_IDS,
  FEST_TICKETS,
  FEST_TICKET_IDS,
  FEST_TIERS,
  FEST_TIER_IDS,
  festBlocker,
  festDemand,
  festQuote,
} from '@/world/ownfest';
import type { FestHeadliner, FestTicket, FestTier } from '@/world/types';
import { LOAN_MARGIN, marketNow, monthlyInterest } from '@/world/market';
import { SEASON, baseRate } from '@/world/content/economy';
import { ZONES } from '@/world/content/regulations';
import { dayOf, formatDay, yearOf } from '@/world/core';
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

      <h4>Your own festival</h4>
      <OwnFestivalPanel ctx={ctx} />

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

function Pick<T extends string>({ label, value, ids, text, onPick }: { label: string; value: T; ids: T[]; text: (id: T) => string; onPick: (id: T) => void }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div className="tt-dim">{label}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ids.map(id => (
          <button key={id} className="tt-btn sm" data-on={id === value} onClick={() => onPick(id)}>
            {text(id)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Promote your own festival: size, headliner, ticket price, host town. */
function OwnFestivalPanel({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const world = worldOf(state);
  const [tier, setTier] = useState<FestTier>('field');
  const [headliner, setHeadliner] = useState<FestHeadliner>('name');
  const [ticket, setTicket] = useState<FestTicket>('fair');
  const hosts = [...new Set(state.depots.map(d => d.cityId))];
  const [city, setCity] = useState(hosts[0] ?? '');
  const cityId = hosts.includes(city) ? city : hosts[0] ?? '';
  const f = state.ownFestival;
  const history = state.festivalHistory;
  const current = f && f.year === yearOf(state, state.hour) ? f : undefined;
  const quote = festQuote(state, tier, headliner);
  const why = festBlocker(state, tier, headliner);
  const share = festDemand(state, { tier, headliner, ticket, cityId });
  const hostName = (id: string) => world.cityById.get(id)?.name ?? id;

  return (
    <div>
      <Stat label="Your brand">
        <b>{Math.round(state.festivalBrand ?? 0)}</b> <span className="tt-dim">/ 100 · {history.length} edition{history.length === 1 ? '' : 's'}</span>
      </Stat>
      <Bar value={state.festivalBrand ?? 0} max={100} color="#a855f7" />
      {current ? (
        <div className="tt-item" style={{ marginTop: 6 }}>
          <div className="grow" style={{ whiteSpace: 'normal' }}>
            <b>
              {FEST_TIERS[current.tier].label} in {hostName(current.cityId)}
            </b>
            <div className="tt-dim">
              {formatDay(state, current.day)} · {FEST_HEADLINERS[current.headliner].label} · {FEST_TICKETS[current.ticket].label} tickets · {money(current.paid)} spent
            </div>
            {current.status === 'planned' ? (
              <div className="tt-good" style={{ fontSize: 11 }}>
                {current.covered ? 'Stages covered.' : 'Watch the forecast two days out.'}
              </div>
            ) : (
              current.result && (
                <div className={current.result.profit >= 0 ? 'tt-good' : 'tt-bad'}>
                  {current.result.attendance.toLocaleString()} came{current.result.stormed ? ' (in a storm)' : ''} · {current.result.profit >= 0 ? 'profit' : 'loss'}{' '}
                  {money(Math.abs(current.result.profit))}
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          <Pick label="Size" value={tier} ids={FEST_TIER_IDS} text={id => `${FEST_TIERS[id].label} (${FEST_TIERS[id].capacity.toLocaleString()})`} onPick={v => setTier(v as FestTier)} />
          <Pick label="Headliner" value={headliner} ids={FEST_HEADLINER_IDS} text={id => FEST_HEADLINERS[id].label} onPick={v => setHeadliner(v as FestHeadliner)} />
          <Pick label="Tickets" value={ticket} ids={FEST_TICKET_IDS} text={id => `${FEST_TICKETS[id].label} ${money(FEST_TICKETS[id].price)}`} onPick={v => setTicket(v as FestTicket)} />
          {hosts.length > 1 && <Pick label="Host base" value={cityId} ids={hosts} text={hostName} onPick={setCity} />}
          <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
            Up front {money(quote.total)} (set-up {money(quote.setup)}, production {money(quote.production)}, headliner {money(quote.headliner)}). Expected
            crowd about {Math.round(Math.min(1, share) * 100)}% of capacity — a fresh name sells poorly, a built brand sells out.
          </div>
          {why && <div className="tt-warn" style={{ marginTop: 4 }}>{why}</div>}
          <button
            className="tt-btn sm"
            style={{ marginTop: 6 }}
            disabled={!!why}
            onClick={() => {
              const res = ctx.dispatch(s => promoteFestival(s, tier, headliner, ticket, cityId));
              if (res.message) ctx.toast(res.message, res.ok);
            }}
          >
            Announce the festival
          </button>
        </>
      )}
      {history.length > 0 && (
        <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
          Past editions:{' '}
          {history
            .slice(-4)
            .map(e => `${e.year} ${e.attendance ? e.attendance.toLocaleString() : 'cancelled'} (${e.profit >= 0 ? '+' : '−'}${money(Math.abs(e.profit))})`)
            .join(' · ')}
        </div>
      )}
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Plans close at the end of April and you pay up front. A bigger name and cheaper tickets fill the field; your own fleet trims the production bill. A
        storm can empty it, and a shutdown cancels it.
      </div>
    </div>
  );
}
