import { LOAN_MARGIN, marketNow, monthlyInterest } from '@/world/market';
import { SEASON, baseRate } from '@/world/content/economy';
import { Bar, Stat } from './bits';
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
