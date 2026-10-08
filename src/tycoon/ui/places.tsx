import { gigBookingBar } from '@/world/standing';
import { useState } from 'react';
import { buildDepot, buyVehicle, fireCrew, hireCrew } from '@/world/actions';
import { stockSize } from '@/world/loading';
import { GearShop, WarehouseGear } from './gear';
import {
  CREW_HIRE_COST,
  DEPOT_BUILD_COST,
  DEPOT_UPKEEP_PER_MONTH,
  companyTier,
  getModel,
} from '@/world/catalog';
import { dayOf, depotInCity, formatDay, freeLot } from '@/world/core';
import { worldOf } from '@/world/mapgen';
import { vehicleActivity } from '@/world/queries';
import type { Gig } from '@/world/types';
import { gigDates } from './gigInfo';
import { ContractCard } from './contracts';
import { Bar, FatigueChip, Stat, TierChip } from './bits';
import { crewWage } from '@/world/crew';
import { formatPopulation, kmoney, marketLabel, money, ratingLabel } from './format';
import type { WinCtx } from './types';

const VENUE_KIND_LABEL: Record<string, string> = {
  pub: 'Pub',
  hall: 'Town hall',
  club: 'Club',
  theatre: 'Theatre',
  arena: 'Arena',
  stadium: 'Stadium',
  airport: 'International airport',
};

function GigRow({ ctx, gig }: { ctx: WinCtx; gig: Gig }) {
  const today = dayOf(ctx.state.hour);
  const locked = !!gigBookingBar(ctx.state, gig).reason;
  const venue = worldOf(ctx.state).venueById.get(gig.venueId);
  return (
    <div className="tt-item clickable" onClick={() => ctx.open('gig', gig.id)}>
      <div className="grow">
        <div style={{ fontWeight: 700 }}>
          {gig.asksForYou ? '♥ ' : ''}
          {gig.act}
        </div>
        <div className="tt-dim">
          {gig.festival ? `🎪 ${gig.festival.stage}` : venue?.name} · {gigDates(ctx.state, gig)} ({gig.day - today}d)
        </div>
      </div>
      {gig.status === 'booked' ? (
        <span className="tt-chip" style={{ background: ctx.state.company.color, color: '#fff' }}>
          BOOKED
        </span>
      ) : (
        <TierChip tier={gig.tier} locked={locked} />
      )}
      <span style={{ fontWeight: 800 }}>{kmoney(gig.fee)}</span>
    </div>
  );
}

export function CityWindow({ ctx, cityId }: { ctx: WinCtx; cityId: string }) {
  const { state } = ctx;
  const world = worldOf(state);
  const city = world.cityById.get(cityId);
  if (!city) return null;
  const rating = state.cityRatings[cityId] ?? 50;
  const depot = depotInCity(state, cityId);
  const rivalsHere = state.rivals.filter(r => r.hqCityId === cityId);
  const lotFree = freeLot(state, world, cityId) >= 0;
  const today = dayOf(state.hour);
  const gigs = state.gigs
    .filter(g => g.cityId === cityId && ((g.status === 'offer' && g.acceptByDay >= today) || g.status === 'booked'))
    .sort((a, b) => a.day - b.day);
  const tier = companyTier(state.company.reputation);

  return (
    <div>
      <div className="tt-row" style={{ marginBottom: 4 }}>
        <span className="tt-dim">{marketLabel(city.size)}</span>
        <button className="tt-btn sm" onClick={() => ctx.goTo(city.x, city.y)}>
          Show on map
        </button>
      </div>
      <Stat label="Population (metro)">{city.population.toLocaleString('en-US')}</Stat>
      <Stat label="Your local rating">
        <span className={rating >= 50 ? 'tt-good' : 'tt-bad'}>{ratingLabel(rating)}</span>
      </Stat>
      <h4>Venues</h4>
      <div className="tt-list">
        {city.venues.filter(v => v.kind !== 'airport').map(v => (
          <div key={v.id} className="tt-item clickable" onClick={() => ctx.open('venue', v.id)}>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{v.name}</div>
              <div className="tt-dim">
                {VENUE_KIND_LABEL[v.kind]} · {v.capacity.toLocaleString()} cap
              </div>
            </div>
            <TierChip tier={v.tier} locked={v.tier > tier} />
          </div>
        ))}
      </div>
      {city.venues.some(v => v.kind === 'airport') && (
        <div className="tt-item" style={{ marginTop: 3 }}>
          <span>✈</span>
          <span className="grow">International airport — world-tour freight flies out from here.</span>
        </div>
      )}
      <h4>Shows here</h4>
      {gigs.length ? (
        <div className="tt-list">
          {gigs.map(g => (
            <GigRow key={g.id} ctx={ctx} gig={g} />
          ))}
        </div>
      ) : (
        <div className="tt-dim">No open offers right now.</div>
      )}
      <h4>Warehouse lots ({city.lots.length})</h4>
      <div className="tt-list">
        {rivalsHere.map(r => (
          <div key={r.id} className="tt-item">
            <span style={{ width: 10, height: 10, background: r.color, display: 'inline-block' }} />
            <span className="grow" style={{ fontWeight: 700 }}>
              {r.name}
            </span>
            <span className="tt-dim">{r.specialty}</span>
          </div>
        ))}
        {depot && (
          <button className="tt-btn sm" onClick={() => ctx.open('depot', depot.id)}>
            Open your {city.name} warehouse
          </button>
        )}
      </div>
      {!depot &&
        (lotFree ? (
          <div className="tt-row" style={{ marginTop: 6 }}>
            <span className="tt-dim">
              Build here to base trucks, gear and crew locally. Upkeep {money(DEPOT_UPKEEP_PER_MONTH)}/mo.
            </span>
            <button
              className="tt-btn sm primary"
              disabled={state.company.cash < DEPOT_BUILD_COST}
              onClick={() => {
                const r = ctx.dispatch(s => buildDepot(s, cityId));
                ctx.toast(r.message ?? '', r.ok);
              }}
            >
              Build {kmoney(DEPOT_BUILD_COST)}
            </button>
          </div>
        ) : (
          <div className="tt-dim" style={{ marginTop: 6 }}>
            Every lot here is taken.
          </div>
        ))}
    </div>
  );
}

export function VenueWindow({ ctx, venueId }: { ctx: WinCtx; venueId: string }) {
  const { state } = ctx;
  const world = worldOf(state);
  const venue = world.venueById.get(venueId);
  if (!venue) return null;
  const city = world.cityById.get(venue.cityId)!;
  const today = dayOf(state.hour);
  const gigs = state.gigs
    .filter(g => g.venueId === venueId && ((g.status === 'offer' && g.acceptByDay >= today) || g.status === 'booked'))
    .sort((a, b) => a.day - b.day);
  const history = state.gigs.filter(g => g.venueId === venueId && (g.status === 'done' || g.status === 'failed' || (g.status === 'rival' && g.result)));
  const tier = companyTier(state.company.reputation);
  const contract = state.contracts.find(c => c.venueId === venueId && (c.status === 'offer' || c.status === 'active' || c.status === 'rival'));
  return (
    <div>
      <div className="tt-row">
        <span>
          {VENUE_KIND_LABEL[venue.kind]} in{' '}
          <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('city', city.id)}>
            {city.name}
          </a>
        </span>
        <TierChip tier={venue.tier} locked={venue.tier > tier} />
      </div>
      <Stat label="Capacity">{venue.capacity.toLocaleString()}</Stat>
      {contract && (
        <>
          <h4>House contract</h4>
          <ContractCard ctx={ctx} c={contract} />
        </>
      )}
      <h4>Upcoming</h4>
      {gigs.length ? (
        <div className="tt-list">
          {gigs.map(g => (
            <GigRow key={g.id} ctx={ctx} gig={g} />
          ))}
        </div>
      ) : (
        <div className="tt-dim">Nothing on offer here at the moment.</div>
      )}
      {history.length > 0 && (
        <>
          <h4>Recent shows</h4>
          <div className="tt-list">
            {history.slice(-4).reverse().map(g => {
              const rival = state.rivals.find(r => r.id === g.rivalId);
              return (
                <div key={g.id} className="tt-item">
                  <div className="grow">
                    <div>{g.act}</div>
                    <div className="tt-dim">{formatDay(state, g.day)}</div>
                  </div>
                  {rival ? (
                    <span style={{ color: rival.color, fontWeight: 700 }}>{rival.name}</span>
                  ) : (
                    <span className={g.status === 'done' ? 'tt-good' : 'tt-bad'}>
                      {g.status === 'done' ? `${Math.round((g.result?.quality ?? 0) * 100)}%` : 'Failed'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function DepotWindow({ ctx, depotId }: { ctx: WinCtx; depotId: string }) {
  const { state } = ctx;
  const [tab, setTab] = useState<'stock' | 'shop' | 'buy'>('stock');
  const depot = state.depots.find(d => d.id === depotId);
  if (!depot) return null;
  const world = worldOf(state);
  const fleet = state.vehicles.filter(v => v.owner === 'player' && v.homeCityId === depot.cityId);
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (!r.ok || r.message) ctx.toast(r.message ?? 'Done', r.ok);
  };

  return (
    <div>
      <div className="tt-tabs">
        <button className="tt-btn sm" data-on={tab === 'stock'} onClick={() => setTab('stock')}>
          Warehouse
        </button>
        <button className="tt-btn sm" data-on={tab === 'shop'} onClick={() => setTab('shop')}>
          Gear shop
        </button>
        <button className="tt-btn sm" data-on={tab === 'buy'} onClick={() => setTab('buy')}>
          Vehicles
        </button>
      </div>
      {tab === 'shop' ? (
        <GearShop ctx={ctx} depot={depot} />
      ) : tab === 'stock' ? (
        <>
          <h4>Gear in the warehouse</h4>
          <WarehouseGear ctx={ctx} depot={depot} />
          <h4>Crew</h4>
          <div className="tt-item">
            <span className="grow">
              {depot.crew} idle here <span className="tt-dim">· {money(crewWage(state))}/day each</span>{' '}
              {depot.crew > 0 && <FatigueChip value={depot.fatigue ?? 0} />}
            </span>
            <button className="tt-btn sm" onClick={() => act(s => fireCrew(s, depot.id))}>
              −
            </button>
            <button className="tt-btn sm" onClick={() => act(s => hireCrew(s, depot.id))}>
              Hire {money(CREW_HIRE_COST)}
            </button>
          </div>
          <h4>Vehicles based here ({fleet.length})</h4>
          <div className="tt-list">
            {fleet.map(v => (
              <div key={v.id} className="tt-item clickable" onClick={() => ctx.open('vehicle', v.id)}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>
                    {v.name} <span className="tt-dim">{getModel(v.modelId).name}</span>
                  </div>
                  <div className="tt-dim">{vehicleActivity(state, v)}</div>
                </div>
              </div>
            ))}
            {!fleet.length && <div className="tt-dim">No vehicles yet — buy one from the next tab.</div>}
          </div>
        </>
      ) : (
        <div className="tt-list">
          {state.announcedModels.map(id => {
            const m = getModel(id);
            return (
              <div key={id} className="tt-item">
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div className="tt-dim">
                    {m.gearCapacity} gear · {m.crewSeats} seats · {Math.round(m.speed * 24)} tiles/day · {kmoney(m.runningCostPerYear)}/yr
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span className="tt-dim" style={{ fontSize: 11 }}>
                      Reliability
                    </span>
                    <Bar value={m.reliability} max={100} color="#4ade80" />
                  </div>
                </div>
                <button
                  className="tt-btn sm primary"
                  disabled={state.company.cash < m.price}
                  onClick={() => act(s => buyVehicle(s, depot.id, id))}
                >
                  {kmoney(m.price)}
                </button>
              </div>
            );
          })}
          <div className="tt-dim" style={{ marginTop: 4 }}>
            New models arrive as the years go by.
          </div>
        </div>
      )}
      <div className="tt-dim" style={{ marginTop: 8 }}>
        {world.cityById.get(depot.cityId)?.name} · opened {formatDay(state, Math.floor(depot.builtHour / 24))}
      </div>
    </div>
  );
}

export function DepotListWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const world = worldOf(state);
  return (
    <div>
      <div className="tt-list">
        {state.depots.map(d => {
          const units = stockSize(d.gear);
          return (
            <div key={d.id} className="tt-item clickable" onClick={() => ctx.open('depot', d.id)}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>
                  {world.cityById.get(d.cityId)?.name}
                  {d.cityId === state.company.hqCityId ? ' (HQ)' : ''}
                </div>
                <div className="tt-dim">
                  {units} gear units · {d.crew} crew idle · {state.vehicles.filter(v => v.owner === 'player' && v.homeCityId === d.cityId).length} vehicles
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="tt-dim" style={{ marginTop: 8 }}>
        To open another warehouse, click any town on the map and choose <b>Build</b>. Regional warehouses cut drive times and
        let you base gear where the work is.
      </div>
    </div>
  );
}

export function TownsWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const world = worldOf(state);
  const today = dayOf(state.hour);
  const tier = companyTier(state.company.reputation);
  const towns = [...world.cities].sort((a, b) => b.population - a.population);
  return (
    <div className="tt-list">
      {towns.map(c => {
        const rating = state.cityRatings[c.id] ?? 50;
        const offers = state.gigs.filter(g => g.cityId === c.id && g.status === 'offer' && g.acceptByDay >= today).length;
        const topTier = Math.max(...c.venues.map(v => v.tier));
        const rival = state.rivals.find(r => r.hqCityId === c.id);
        return (
          <div
            key={c.id}
            className="tt-item clickable"
            onClick={() => {
              ctx.goTo(c.x, c.y);
              ctx.open('city', c.id);
            }}
          >
            <div className="grow">
              <div style={{ fontWeight: 700 }}>
                {c.name}
                {depotInCity(state, c.id) ? ' 🏭' : ''}
                {rival ? <span style={{ color: rival.color }}> ●</span> : null}
              </div>
              <div className="tt-dim">
                {formatPopulation(c.population)} · {ratingLabel(rating)}
                {offers ? ` · ${offers} offer${offers > 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <TierChip tier={topTier} locked={topTier > tier} />
          </div>
        );
      })}
    </div>
  );
}
