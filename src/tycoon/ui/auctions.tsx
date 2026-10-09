import { useState } from 'react';
import { bidAuction } from '@/world/actions';
import { dayOf } from '@/world/core';
import { AUCTION_DAYS, lotBlocker, lotName, lotPrice, priceFactor } from '@/world/auctions';
import { worldOf } from '@/world/mapgen';
import { money } from './format';
import type { WinCtx } from './types';

/** Used kit and trucks from bankrupt firms and closing shops — the price slides until someone bites. */
export function AuctionsWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const world = worldOf(state);
  const [depotId, setDepotId] = useState(state.depots[0]?.id ?? '');
  const day = dayOf(state.hour);
  const cityName = (id: string) => world.cityById.get(id)?.name ?? '?';
  const buy = (auctionId: string, lotId: string) => {
    const r = ctx.dispatch(s => bidAuction(s, auctionId, lotId, depotId));
    if (r.message) ctx.toast(r.message, r.ok);
  };

  return (
    <div>
      <div className="tt-row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <span className="tt-dim">Send purchases to</span>
        <select className="tt-input" value={depotId} onChange={e => setDepotId(e.target.value)}>
          {state.depots.map(d => (
            <option key={d.id} value={d.id}>
              {cityName(d.cityId)} ({d.kind})
            </option>
          ))}
        </select>
      </div>
      {!state.auctions.length && (
        <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
          No auctions right now. When a rival goes under or a hire shop closes, its kit and trucks turn up here for {AUCTION_DAYS} days.
        </div>
      )}
      {state.auctions.map(a => (
        <div key={a.id}>
          <h4>
            {a.seller} — {cityName(a.cityId)} <span className="tt-dim">· {Math.max(0, a.endDay - day)} days left</span>
          </h4>
          <div className="tt-dim" style={{ marginBottom: 4, whiteSpace: 'normal' }}>
            Asking {Math.round(priceFactor(a, day) * 100)}% of market value and falling — but every day someone else may take a lot.
          </div>
          <div className="tt-list">
            {a.lots.map(lot => {
              const blocker = lotBlocker(state, a, lot, depotId);
              return (
                <div key={lot.id} className="tt-item" style={{ gap: 6 }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <b>{lotName(lot)}</b>
                    <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                      {lot.kind === 'gear' ? `Condition ${lot.condition}%` : `Reliability ${lot.reliability}%`} · market value {money(lot.value)}
                      {blocker && <span> · {blocker}</span>}
                    </div>
                  </div>
                  <button className="tt-btn sm primary" disabled={!!blocker} onClick={() => buy(a.id, lot.id)}>
                    Buy {money(lotPrice(a, lot, day))}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="tt-dim" style={{ marginTop: 6, whiteSpace: 'normal' }}>
        Used kit arrives worn (and drags down the condition of what you already own of that product); used trucks are older and
        less reliable. Workshop and refurbishing can bring them back.
      </div>
    </div>
  );
}
