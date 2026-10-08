import { cancelRnd, startRnd } from '@/world/actions';
import { DEPT_COLORS, DEPT_LABELS } from '@/world/catalog';
import { getProduct } from '@/world/content/gear';
import { yearOf } from '@/world/core';
import { AMBITIONS, AMBITION_IDS, RND_REPUTATION, marketBest, projectCost, projectEta, rndBlocker, royaltiesPerMonth } from '@/world/rnd';
import { DEPTS, type Dept } from '@/world/types';
import { useState } from 'react';
import { Bar, Stat } from './bits';
import { BrandBadge, GearSprite } from './brands';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

export function RndWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const year = yearOf(state, state.hour);
  const [dept, setDept] = useState<Dept>('audio');
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const running = state.projects.filter(p => p.status === 'running');
  const best = marketBest(dept, year);
  const blocker = rndBlocker(state, dept);
  return (
    <div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
        Build your own kit, like Clair, Showco and Meyer did. Fund a project: on success your product joins the gear shop —
        better than anything on the market, cheap for you to build — and the industry pays you royalties while it's current.
      </div>

      <h4>Your designs</h4>
      {state.ownProducts.length ? (
        <div className="tt-list">
          {state.ownProducts.map(id => {
            const p = getProduct(id);
            return (
              <div key={id} className="tt-item">
                <GearSprite productId={id} size={32} />
                <div className="grow">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <BrandBadge brand={p.brand} color={state.company.color} />
                    <b>{p.name}</b>
                  </div>
                  <div className="tt-dim">
                    {DEPT_LABELS[p.dept]} · quality {p.quality} · builds for {money(p.price)} · {p.introYear}
                  </div>
                </div>
                <span className="tt-good">+{kmoney(royaltiesPerMonth(state, id))}/mo</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tt-dim">None yet.</div>
      )}

      <h4>In development</h4>
      {running.length ? (
        <div className="tt-list">
          {running.map(p => {
            const info = AMBITIONS[p.ambition];
            return (
              <div key={p.id} className="tt-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 3 }}>
                <div className="tt-row">
                  <b>
                    {info.label}: {DEPT_LABELS[p.dept]} ({p.series} series)
                  </b>
                  <button className="tt-btn sm" onClick={() => act(s => cancelRnd(s, p.id))}>
                    Shelve
                  </button>
                </div>
                <Bar value={p.monthsDone} max={info.months} color={DEPT_COLORS[p.dept]} />
                <div className="tt-dim">
                  Month {p.monthsDone}/{info.months} · {money(Math.round(p.budget / info.months))}/month · due {projectEta(state, info.months, p.startedDay)} ·{' '}
                  {Math.round(info.risk * 100)}% risk
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tt-dim">Nothing on the bench.</div>
      )}

      <h4>Start a project</h4>
      <div className="tt-tabs">
        {DEPTS.map(d => (
          <button key={d} className="tt-btn sm" data-on={dept === d} onClick={() => setDept(d)}>
            {DEPT_LABELS[d]}
          </button>
        ))}
      </div>
      <Stat label="Best on the market">{best ? `${best.brand} ${best.name} (quality ${best.quality})` : '—'}</Stat>
      {blocker ? (
        <div className="tt-warn" style={{ whiteSpace: 'normal' }}>
          {blocker}
        </div>
      ) : (
        <div className="tt-list">
          {AMBITION_IDS.map(id => {
            const info = AMBITIONS[id];
            return (
              <button key={id} className="tt-item clickable" style={{ textAlign: 'left' }} onClick={() => act(s => startRnd(s, dept, id))}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{info.label}</div>
                  <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                    {info.blurb} Quality ≈ {best ? Math.min(10.5, best.quality + info.lift).toFixed(1) : '?'} · {info.months} months ·{' '}
                    {Math.round(info.risk * 100)}% risk
                  </div>
                </div>
                <b>{kmoney(projectCost(dept, id, year))}</b>
              </button>
            );
          })}
        </div>
      )}
      <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
        Needs reputation {RND_REPUTATION}+ and a warehouse with at least 2 prep staff. Costs are paid monthly; shelving a project
        stops the bills.
      </div>
    </div>
  );
}
