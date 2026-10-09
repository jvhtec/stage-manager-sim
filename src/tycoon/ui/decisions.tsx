import { makeDecision } from '@/world/actions';
import { formatHour, gigById } from '@/world/core';
import { money } from './format';
import type { WinCtx } from './types';

/** Problems waiting on your call — each with a deadline and a do-nothing default. */
export function DecisionsWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const act = (id: string, option: string) => {
    const r = ctx.dispatch(s => makeDecision(s, id, option));
    if (r.message) ctx.toast(r.message, r.ok);
  };
  if (!state.dilemmas.length)
    return (
      <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
        Nothing needs your call right now. When a truck breaks down with a show at stake or a venue throws up a problem, the
        game pauses and asks you here.
      </div>
    );
  return (
    <div>
      {state.dilemmas.map(d => {
        const gig = d.gigId ? gigById(state, d.gigId) : undefined;
        return (
          <div key={d.id} className="tt-decision">
            <h4 style={{ marginTop: 0 }}>{d.title}</h4>
            <div style={{ whiteSpace: 'normal', marginBottom: 6 }}>{d.text}</div>
            <div className="tt-list">
              {d.options.map(o => (
                <button
                  key={o.id}
                  className="tt-btn tt-choice"
                  disabled={!!o.cost && state.company.cash < o.cost}
                  onClick={() => act(d.id, o.id)}
                  style={{ textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}
                >
                  <span className="grow" style={{ whiteSpace: 'normal' }}>
                    <b>{o.label}</b>
                    <br />
                    <span className="tt-dim">{o.detail}</span>
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{o.cost ? money(o.cost) : 'free'}</span>
                </button>
              ))}
            </div>
            <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
              Decide by {formatHour(state, d.expiresHour)} or it’s “{d.options.find(o => o.id === d.defaultOption)?.label.toLowerCase()}”.
              {gig && (
                <>
                  {' '}
                  <a href="#" onClick={e => (e.preventDefault(), ctx.open('gig', gig.id))}>
                    {gig.act} ›
                  </a>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
