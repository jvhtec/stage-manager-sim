import { assignTech, hireTech, releaseTech } from '@/world/actions';
import { DEPT_COLORS } from '@/world/catalog';
import { getTech, techsActiveIn, type StarTech } from '@/world/content/techs';
import { yearOf } from '@/world/core';
import { money } from './format';
import type { WinCtx } from './types';

function Initials({ tech }: { tech: StarTech }) {
  const initials = tech.name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      style={{
        width: 34,
        height: 34,
        display: 'grid',
        placeItems: 'center',
        background: DEPT_COLORS[tech.dept],
        color: '#0b0d12',
        fontWeight: 900,
        fontSize: 13,
        border: '2px solid #0b0d12',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function TechInfo({ tech }: { tech: StarTech }) {
  return (
    <div className="grow" style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 800 }}>
        {tech.name} <span className="tt-dim" style={{ fontWeight: 500 }}>{'★'.repeat(tech.skill)}</span>
      </div>
      <div className="tt-dim">
        {tech.role} · {tech.from}–{tech.to >= 2025 ? 'today' : tech.to}
      </div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', fontSize: 11.5 }}>
        Known for {tech.knownFor.join(', ')}
      </div>
    </div>
  );
}

export function TalentWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const year = yearOf(state, state.hour);
  const hired = state.techs;
  const available = techsActiveIn(year, state.country).filter(t => !hired.some(h => h.techId === t.id));
  const fleet = state.vehicles.filter(v => v.owner === 'player');
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };

  return (
    <div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
        The big names behind the desk. Put one on a truck and every show that truck plays gets a lift — a bigger one for
        acts they're known for. They don't come cheap, and they retire when their careers did.
      </div>
      <h4>On your payroll ({hired.length})</h4>
      <div className="tt-list">
        {hired.map(h => {
          const t = getTech(h.techId);
          return (
            <div key={h.techId} className="tt-item" style={{ flexWrap: 'wrap' }}>
              <Initials tech={t} />
              <TechInfo tech={t} />
              <div style={{ display: 'flex', gap: 4, width: '100%', alignItems: 'center' }}>
                <select
                  className="tt-input"
                  style={{ flex: 1, padding: '3px 6px' }}
                  value={h.vehicleId ?? ''}
                  onChange={e => act(s => assignTech(s, h.techId, e.target.value || null))}
                >
                  <option value="">At base</option>
                  {fleet.map(v => (
                    <option key={v.id} value={v.id}>
                      Riding with {v.name}
                    </option>
                  ))}
                </select>
                <span className="tt-dim">{money(t.wagePerDay)}/day</span>
                <button className="tt-btn sm" onClick={() => act(s => releaseTech(s, h.techId))}>
                  Let go
                </button>
              </div>
            </div>
          );
        })}
        {!hired.length && <div className="tt-dim">Nobody yet.</div>}
      </div>
      <h4>Taking calls in {year}</h4>
      <div className="tt-list">
        {available.map(t => (
          <div key={t.id} className="tt-item">
            <Initials tech={t} />
            <TechInfo tech={t} />
            <div style={{ textAlign: 'right' }}>
              <button className="tt-btn sm primary" disabled={state.company.cash < t.fee} onClick={() => act(s => hireTech(s, t.id))}>
                Sign {money(t.fee)}
              </button>
              <div className="tt-dim" style={{ fontSize: 11 }}>
                {money(t.wagePerDay)}/day
              </div>
            </div>
          </div>
        ))}
        {!available.length && <div className="tt-dim">No big names available this year.</div>}
      </div>
    </div>
  );
}
