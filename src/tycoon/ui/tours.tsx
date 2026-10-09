import { tourBookingBar } from '@/world/standing';
import { assignVehicleToTour, bookTour } from '@/world/actions';
import { getModel } from '@/world/catalog';
import { dayOf, formatDay, lastShowDay } from '@/world/core';
import { findArtist } from '@/world/content/artists';
import { getRegion } from '@/world/content/world';
import { canBookTour, tourGigs, tourMaxTier } from '@/world/tours';
import type { Tour, TycoonState } from '@/world/types';
import { Stat, TierChip } from './bits';
import { kmoney, money } from './format';
import { READINESS_CLASS, gigReadiness, gigWhere } from './gigInfo';
import type { WinCtx } from './types';

const STATUS_LABEL: Record<Tour['status'], string> = {
  offer: 'On offer',
  booked: 'Booked',
  done: 'Completed',
  failed: 'Dates dropped',
  expired: 'Expired',
  rival: 'Lost to a rival',
};

function tourTotals(state: TycoonState, tour: Tour) {
  const gigs = tourGigs(state, tour);
  const fees = gigs.reduce((sum, g) => sum + g.fee, 0);
  const first = Math.min(...gigs.map(g => g.day));
  const last = Math.max(...gigs.map(g => lastShowDay(g)));
  const dates = gigs.reduce((n, g) => n + (g.overseas ? g.overseas.stops.length : 1), 0);
  return { gigs, fees, first, last, dates };
}

export function TourList({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const today = dayOf(state.hour);
  const tours = state.tours
    .filter(t => (t.status === 'offer' && t.acceptByDay >= today) || t.status === 'booked' || t.status === 'done' || t.status === 'failed')
    .sort((a, b) => ['offer', 'booked', 'done', 'failed'].indexOf(a.status) - ['offer', 'booked', 'done', 'failed'].indexOf(b.status));
  if (!tours.length) {
    return (
      <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
        No tours on offer right now. Promoters announce national tours every couple of weeks, and the big acts go on world
        tours — watch the news.
      </div>
    );
  }
  return (
    <div className="tt-list">
      {tours.map(t => {
        const { fees, first, dates } = tourTotals(state, t);
        const locked = t.status === 'offer' && !canBookTour(state, t);
        return (
          <div key={t.id} className="tt-item clickable" onClick={() => ctx.open('tour', t.id)}>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>
                {t.kind === 'world' ? '🌍 ' : '🚚 '}
                {t.name}
              </div>
              <div className="tt-dim">
                {dates} dates from {formatDay(state, first)} · {STATUS_LABEL[t.status]}
              </div>
            </div>
            {t.status === 'offer' && <TierChip tier={tourMaxTier(state, t)} locked={locked} />}
            <b>{kmoney(fees + t.bonus)}</b>
          </div>
        );
      })}
    </div>
  );
}

export function TourWindow({ ctx, tourId }: { ctx: WinCtx; tourId: string }) {
  const { state } = ctx;
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return <div className="tt-dim">This tour has dropped off the books.</div>;
  const { gigs, fees, first, last } = tourTotals(state, tour);
  const artist = findArtist(tour.act);
  const maxTier = tourMaxTier(state, tour);
  const rival = state.rivals.find(r => r.id === tour.rivalId);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };
  const fleet = state.vehicles.filter(v => v.owner === 'player');

  return (
    <div>
      <div className="tt-row">
        <span className="tt-dim">
          {artist?.genre ?? 'Live'} · {tour.kind === 'world' ? 'World tour' : 'National tour'}
        </span>
        <TierChip tier={maxTier} locked={tour.status === 'offer' && !canBookTour(state, tour)} />
      </div>
      <Stat label="Runs">
        {formatDay(state, first)} → {formatDay(state, last)}
      </Stat>
      <Stat label="Show fees">{money(fees)}</Stat>
      <Stat label="Completion bonus">
        <b className="tt-good">+{money(tour.bonus)}</b>
      </Stat>
      <Stat label="Status">{rival ? <span style={{ color: rival.color, fontWeight: 700 }}>Won by {rival.name}</span> : STATUS_LABEL[tour.status]}</Stat>
      {tour.status === 'offer' && <Stat label="Book by">{formatDay(state, tour.acceptByDay)}</Stat>}

      {tour.kind === 'world' && (
        <button className="tt-btn sm" onClick={() => ctx.open('worldmap', tour.id)} style={{ marginTop: 4 }}>
          🌍 Show on the world map
        </button>
      )}

      <h4>Dates</h4>
      <div className="tt-list">
        {gigs.map(g => {
          const readiness = tour.status === 'booked' && g.status === 'booked' ? gigReadiness(state, g) : null;
          return (
            <div key={g.id} className="tt-item clickable" onClick={() => ctx.open('gig', g.id)}>
              <div className="grow">
                <div style={{ fontWeight: 700, whiteSpace: 'normal' }}>{gigWhere(state, g)}</div>
                <div className="tt-dim">
                  {formatDay(state, g.day)}
                  {g.overseas ? ` – ${formatDay(state, lastShowDay(g))} · ${getRegion(g.overseas.regionId).freightDays}d air freight each way` : ''}
                  {g.rider ? ` · rider: ${g.rider.brand}` : ''}
                </div>
              </div>
              {readiness ? (
                <span className={READINESS_CLASS[readiness]} style={{ fontWeight: 800, fontSize: 11 }}>
                  {readiness}
                </span>
              ) : g.result ? (
                <span className={g.status === 'done' ? 'tt-good' : 'tt-bad'} style={{ fontWeight: 800 }}>
                  {Math.round(g.result.quality * 100)}%
                </span>
              ) : (
                <b>{kmoney(g.fee)}</b>
              )}
            </div>
          );
        })}
      </div>

      {tour.status === 'offer' &&
        (canBookTour(state, tour) ? (
          <button className="tt-btn primary" style={{ marginTop: 10 }} onClick={() => act(s => bookTour(s, tour.id))}>
            Book the whole tour
          </button>
        ) : (
          <div className="tt-warn" style={{ marginTop: 8, whiteSpace: 'normal' }}>
            {tourBookingBar(state, tour, maxTier).reason} You have {Math.round(state.company.reputation)}.
          </div>
        ))}

      {tour.status === 'booked' && (
        <>
          <h4>Put a vehicle on every date</h4>
          <div className="tt-dim" style={{ whiteSpace: 'normal', marginBottom: 4 }}>
            It tours the route in order: straight from venue to venue, then to the airport for any legs abroad.
          </div>
          <div className="tt-list">
            {fleet.map(v => {
              const m = getModel(v.modelId);
              const onAll = gigs.every(g => g.status !== 'booked' || v.orders.includes(g.id));
              return (
                <div key={v.id} className="tt-item">
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>
                      {v.name} <span className="tt-dim">{m.name}</span>
                    </div>
                    <div className="tt-dim">
                      {m.gearCapacity} gear · {m.crewSeats} seats
                    </div>
                  </div>
                  <button className="tt-btn sm primary" disabled={onAll} onClick={() => act(s => assignVehicleToTour(s, v.id, tour.id))}>
                    {onAll ? 'On tour' : '+ Whole tour'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
