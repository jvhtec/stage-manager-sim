import { useState } from 'react';
import { buyGear, refurbishGear, sellGear, transferGear } from '@/world/actions';
import { describeQuote, transferQuote } from '@/world/transfers';
import { partnerPrice } from '@/world/partners';
import { worldOf } from '@/world/mapgen';
import { condition, ownedStock, refurbishCost, resaleValue } from '@/world/wear';
import { brandShares, supportNote, supportOf } from '@/world/ecosystem';
import { DEPT_LABELS } from '@/world/catalog';
import { expectedQuality, getProduct, isOwnProduct } from '@/world/content/gear';
import { yearOf } from '@/world/core';
import { deptTotals } from '@/world/loading';
import { DEPTS, type Depot, type GearStock, type TycoonState } from '@/world/types';
import { DeptDot } from './bits';
import { BrandBadge, GearSprite } from './brands';
import { kmoney, money } from './format';
import type { WinCtx } from './types';

/** Quality score coloured against what this year's crowds expect. */
export function QualityChip({ quality, state }: { quality: number; state: TycoonState }) {
  const year = yearOf(state, state.hour);
  const color =
    quality >= expectedQuality(4, year)
      ? '#facc15'
      : quality >= expectedQuality(3, year)
        ? '#f472b6'
        : quality >= expectedQuality(2, year)
          ? '#38bdf8'
          : quality >= expectedQuality(1, year)
            ? '#94a3b8'
            : '#f87171';
  return (
    <span className="tt-chip" style={{ background: color }} title="Gear quality (1-10)">
      Q{quality}
    </span>
  );
}

/** Condition of a product line (0-100), green → amber → red. */
export function ConditionChip({ value }: { value: number }) {
  const v = Math.round(value);
  const color = v >= 80 ? '#22c55e' : v >= 55 ? '#f59e0b' : '#ef4444';
  return (
    <span className="tt-chip" style={{ background: color, minWidth: 34, textAlign: 'center' }} title="Condition — worn kit sounds worse and fails more">
      {v}%
    </span>
  );
}

/** One line per product, grouped by department. */
export function StockLines({ stock, state }: { stock: GearStock; state: TycoonState }) {
  const totals = deptTotals(stock);
  return (
    <div className="tt-list">
      {DEPTS.filter(d => totals[d] > 0).map(d => (
        <div key={d}>
          {Object.keys(stock)
            .filter(id => stock[id] > 0 && getProduct(id).dept === d)
            .map(id => {
              const p = getProduct(id);
              return (
                <div key={id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <GearSprite productId={id} size={24} />
                  <span className="grow" style={{ flex: 1 }}>
                    {p.brand} {p.name}
                  </span>
                  <QualityChip quality={p.quality} state={state} />
                  <b>×{stock[id]}</b>
                </div>
              );
            })}
        </div>
      ))}
      {!Object.keys(stock).length && <span className="tt-dim">Empty.</span>}
    </div>
  );
}

export function WarehouseGear({ ctx, depot }: { ctx: WinCtx; depot: Depot }) {
  const { state } = ctx;
  const totals = deptTotals(depot.gear);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message || !r.ok) ctx.toast(r.message ?? 'Not possible', r.ok);
  };
  const others = state.depots.filter(d => d.id !== depot.id);
  const [sendTo, setSendTo] = useState<string>('');
  const target = others.find(d => d.id === sendTo);
  const world = worldOf(state);
  return (
    <div className="tt-list">
      {others.length > 0 && (
        <div className="tt-item" style={{ gap: 6 }}>
          <span className="tt-dim">Send kit to</span>
          <select className="tt-input" style={{ flex: 1 }} value={sendTo} onChange={e => setSendTo(e.target.value)}>
            <option value="">— choose a base —</option>
            {others.map(d => (
              <option key={d.id} value={d.id}>
                {world.cityById.get(d.cityId)?.name} ({d.kind})
              </option>
            ))}
          </select>
          {target && <span className="tt-dim">{describeQuote(state, transferQuote(state, depot, target, 1))} per unit</span>}
        </div>
      )}
      {DEPTS.map(d => {
        const shares = brandShares(ownedStock(state));
        const owned = Object.keys(depot.gear)
          .filter(id => depot.gear[id] > 0 && getProduct(id).dept === d)
          .sort((a, b) => getProduct(b).quality - getProduct(a).quality);
        return (
          <div key={d} className="tt-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div className="tt-row">
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
                <DeptDot dept={d} /> {DEPT_LABELS[d]}
              </span>
              <b>
                {totals[d]} unit{totals[d] === 1 ? '' : 's'}
              </b>
            </div>
            {shares[d].units >= 3 && shares[d].share >= 0.5 && (
              <div className="tt-dim" style={{ fontSize: 11, whiteSpace: 'normal' }}>
                {Math.round(shares[d].share * 100)}% {shares[d].brand} across your bases
                {shares[d].share >= 0.7 ? ' — cheaper to keep running, but a fault at the maker hits all of it' : ''}
              </div>
            )}
            {owned.map(id => {
              const p = getProduct(id);
              return (
                <div key={id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <GearSprite productId={id} size={30} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.brand} <span className="tt-dim">{p.name}</span>
                  </span>
                  <QualityChip quality={p.quality} state={state} />
                  <ConditionChip value={condition(state, id)} />
                  {supportOf(id, yearOf(state, state.hour)) !== 'current' && (
                    <span className="tt-chip" style={{ background: supportOf(id, yearOf(state, state.hour)) === 'eol' ? '#7f1d1d' : '#78350f' }} title={supportNote(state, id)}>
                      {supportOf(id, yearOf(state, state.hour)) === 'eol' ? 'EOL' : 'legacy'}
                    </span>
                  )}
                  <b style={{ minWidth: 26, textAlign: 'right' }}>×{depot.gear[id]}</b>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexBasis: '100%' }}>
                    {condition(state, id) < 95 && (
                      <button
                        className="tt-btn sm"
                        title={`Refurbish every ${p.name} you own to as-new`}
                        onClick={() => act(s => refurbishGear(s, id))}
                      >
                        🔧 Refurbish {money(refurbishCost(state, id))}
                      </button>
                    )}
                    {target && (
                      <button className="tt-btn sm" title={`Courier one to ${world.cityById.get(target.cityId)?.name}`} onClick={() => act(s => transferGear(s, depot.id, target.id, id))}>
                        → Send
                      </button>
                    )}
                    <button className="tt-btn sm" title={`Sell one for ${money(resaleValue(state, id))}`} onClick={() => act(s => sellGear(s, depot.id, id))}>
                      Sell +{kmoney(resaleValue(state, id))}
                    </button>
                    <button
                      className="tt-btn sm"
                      title={`Buy one more for ${money(partnerPrice(state, id))}`}
                      disabled={state.company.cash < partnerPrice(state, id)}
                      onClick={() => act(s => buyGear(s, depot.id, id))}
                    >
                      Buy −{kmoney(partnerPrice(state, id))}
                    </button>
                  </div>
                </div>
              );
            })}
            {!owned.length && <span className="tt-dim">None in stock — see the Gear shop.</span>}
          </div>
        );
      })}
    </div>
  );
}

export function GearShop({ ctx, depot }: { ctx: WinCtx; depot: Depot }) {
  const { state } = ctx;
  const year = yearOf(state, state.hour);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (!r.ok) ctx.toast(r.message ?? 'Not possible', false);
  };
  return (
    <div>
      <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 6 }}>
        Crowds in {year} expect quality ≈ {expectedQuality(1, year).toFixed(1)} in pubs, {expectedQuality(2, year).toFixed(1)} in clubs,{' '}
        {expectedQuality(3, year).toFixed(1)} in arenas and {expectedQuality(4, year).toFixed(1)} in stadiums. The bar rises every year.
      </div>
      {DEPTS.map(d => (
        <div key={d} style={{ marginBottom: 8 }}>
          <h4 style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <DeptDot dept={d} /> {DEPT_LABELS[d]}
          </h4>
          <div className="tt-list">
            {[...state.ownProducts, ...state.announcedGear]
              .map(getProduct)
              .filter(p => p.dept === d)
              .sort((a, b) => b.quality - a.quality)
              .map(p => (
                <div key={p.id} className="tt-item">
                  <GearSprite productId={p.id} size={40} />
                  <div className="grow">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <BrandBadge brand={p.brand} />
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                    </div>
                    <div className="tt-dim">
                      {isOwnProduct(p.id) ? '★ Your own design · ' : ''}Since {p.introYear}
                      {depot.gear[p.id] ? ` · you have ${depot.gear[p.id]}` : ''}
                    </div>
                  </div>
                  <QualityChip quality={p.quality} state={state} />
                  <button className="tt-btn sm primary" disabled={state.company.cash < partnerPrice(state, p.id)} onClick={() => act(s => buyGear(s, depot.id, p.id))}>
                    {kmoney(partnerPrice(state, p.id))}
                    {partnerPrice(state, p.id) < p.price && <span title={`${p.brand} partner discount`}> ★</span>}
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
