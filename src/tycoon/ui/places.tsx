import { describeTraits, traitsOf } from '@/world/venueTraits';
import { routeNotes, tripCharges } from '@/world/infra';
import { gigBookingBar } from '@/world/standing';
import { useState } from 'react';
import { buildDepot, buyOwnedVenue, buyVehicle, leaseVehicle, sellOwnedVenue, setVenueProgramme } from '@/world/actions';
import { buyBlocker, buyCost, expectedMonthly, ownable, ownedOf, saleValue, venuePrice, YIELD } from '@/world/owned';
import { LEASE_TERM_MONTHS, leaseMonthly } from '@/world/finance';
import { stockSize } from '@/world/loading';
import { GearShop, WarehouseGear } from './gear';
import {
  companyTier,
  getModel,
} from '@/world/catalog';
import { dayOf, depotInCity, formatDay, freeLot, yearOf } from '@/world/core';
import { localFame } from '@/world/offers';
import { relationFeeBonus, relationLabel, venueRelation } from '@/world/promoters';
import { populationOf, townGrowth } from '@/world/towns';
import { VENUE_YEARS, venueOpenIn } from '@/world/content/venueYears';
import { worldOf } from '@/world/mapgen';
import { vehicleActivity } from '@/world/queries';
import type { Gig } from '@/world/types';
import { gigDates } from './gigInfo';
import { BaseOverview } from './base';
import { VenueDiorama } from './scenes';
import { DELEGATION, RENT_FACTOR, WAREHOUSES, canBaseVehicle, facilitySpec } from '@/world/facilities';
import { ContractCard } from './contracts';
import { Bar, Stat, TierChip } from './bits';
import { distance, formatPopulation, kmoney, marketLabel, money, ratingLabel } from './format';
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
      {city.abroad && (
        <Stat label="Abroad">
          {city.abroad.flag} Over the border — shows only, no bases.{' '}
          <span className="tt-dim">
            {(() => {
              const hq = state.company.hqCityId;
              const n = routeNotes(world, hq, cityId);
              const due = tripCharges(world, hq, cityId, 'truck');
              const bits = [...n.ferries.map(f => `⛴ ${f}`), ...n.tunnels.map(t => `🚇 ${t}`), ...n.borders.map(b => `🛂 border (${b})`)];
              return `${bits.length ? `${bits.join(' · ')} · ` : 'No border checks this year · '}${money(due.total)} tolls, fares & customs each way for a truck from HQ.`;
            })()}
          </span>
        </Stat>
      )}
      <Stat label="Population (metro)">
        {populationOf(state, city).toLocaleString('en-US')}
        {townGrowth(state, city.id) >= 1.02 && <span className="tt-good"> · +{Math.round((townGrowth(state, city.id) - 1) * 100)}% since you started</span>}
      </Stat>
      <Stat label="Your local rating">
        <span className={rating >= 50 ? 'tt-good' : 'tt-bad'}>{ratingLabel(rating)}</span>
        <span className="tt-dim"> · offers ×{localFame(state, cityId).toFixed(2)}</span>
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
      {!city.abroad && <h4>Warehouse lots ({city.lots.length})</h4>}
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
            Open your {city.name} {facilitySpec(depot).label.toLowerCase()}
          </button>
        )}
      </div>
      {!depot &&
        !city.abroad &&
        (lotFree ? (
          <div className="tt-list" style={{ marginTop: 6 }}>
            {([
              ['delegation', DELEGATION],
              ['warehouse', WAREHOUSES[0]],
            ] as const).map(([kind, spec]) => (
              <div key={kind} className="tt-item">
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{kind === 'delegation' ? '🏢' : '🏭'} {spec.label}</div>
                  <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                    {spec.blurb}
                  </div>
                  <div className="tt-dim">
                    Holds {spec.capacity} units · rent here {money(Math.round(spec.rent * RENT_FACTOR[city.size]))}/mo
                  </div>
                </div>
                <button
                  className="tt-btn sm primary"
                  disabled={state.company.cash < spec.build}
                  onClick={() => {
                    const r = ctx.dispatch(s => buildDepot(s, cityId, kind));
                    ctx.toast(r.message ?? '', r.ok);
                  }}
                >
                  {kmoney(spec.build)}
                </button>
              </div>
            ))}
            <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
              A base here means shorter drives and fewer hotel nights for nearby shows, cheaper and better local freelancers, and
              sales staff to bring in work — for rent and salaries every month.
            </div>
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
      <VenueDiorama state={state} venue={venue} />
      <Stat label="Capacity">{venue.capacity.toLocaleString()}</Stat>
      {venue.kind !== 'airport' && (
        <Stat label="The room">
          <span style={{ whiteSpace: 'normal' }}>{describeTraits(traitsOf(world, venue)).join(' · ')}</span>
        </Stat>
      )}
      <Stat label="Promoter">
        <b>{relationLabel(venueRelation(state, venueId))}</b>
        {venueRelation(state, venueId) > 0 && (
          <span className="tt-dim">
            {' '}
            · calls you more, pays +{Math.round((relationFeeBonus(state, venueId) - 1) * 100)}%
          </span>
        )}
      </Stat>
      {!venueOpenIn(venue.name, yearOf(state, state.hour)) && (
        <div className="tt-dim" style={{ whiteSpace: 'normal', margin: '4px 0' }}>
          🚧 Not open yet or closed for rebuilding — no bookings until{' '}
          {VENUE_YEARS[venue.name]?.opens && VENUE_YEARS[venue.name].opens! > yearOf(state, state.hour) ? VENUE_YEARS[venue.name].opens : VENUE_YEARS[venue.name]?.shut?.find(([, to]) => to > yearOf(state, state.hour))?.[1]}.
        </div>
      )}
      {ownable(venue) && (
        <>
          <h4>Ownership</h4>
          {(() => {
            const owned = ownedOf(state, venueId);
            const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
              const r = ctx.dispatch(fn);
              if (r.message) ctx.toast(r.message, r.ok);
            };
            if (!owned) {
              const why = buyBlocker(state, venue);
              return (
                <>
                  <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
                    Lease it out for about {(YIELD.lease * 100).toFixed(1)}% of its value a month, or promote it yourself for about {(YIELD.promote * 100).toFixed(1)}% — less upkeep,
                    and it keeps your name warm in town.
                  </div>
                  {why && <div className="tt-warn" style={{ marginTop: 4 }}>{why}</div>}
                  <button className="tt-btn sm" style={{ marginTop: 6 }} disabled={!!why} onClick={() => act(s => buyOwnedVenue(s, venueId))}>
                    Buy for {money(buyCost(venue))} <span className="tt-dim">(value {money(venuePrice(venue))})</span>
                  </button>
                </>
              );
            }
            return (
              <>
                <Stat label="Condition">
                  <span className={owned.condition < 40 ? 'tt-bad' : ''}>{Math.round(owned.condition)}</span>
                </Stat>
                <Bar value={owned.condition} max={100} color={owned.condition < 40 ? '#ef4444' : '#22c55e'} />
                <Stat label="Expected / month">
                  <b className={expectedMonthly(state, owned) < 0 ? 'tt-bad' : 'tt-good'}>{money(expectedMonthly(state, owned))}</b>
                  <span className="tt-dim"> · {money(owned.earned)} so far</span>
                </Stat>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {(['lease', 'promote'] as const).map(p => (
                    <button key={p} className="tt-btn sm" data-on={owned.programme === p} onClick={() => act(s => setVenueProgramme(s, venueId, p))}>
                      {owned.programme === p ? '● ' : '○ '}
                      {p === 'lease' ? 'Lease it out' : 'Promote it yourself'}
                    </button>
                  ))}
                  <button className="tt-btn sm" onClick={() => act(s => sellOwnedVenue(s, venueId))}>
                    Sell · {money(saleValue(owned))}
                  </button>
                </div>
                <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
                  {owned.programme === 'lease'
                    ? 'Steady rent from a tenant promoter.'
                    : 'Your own nights: pays more when the economy and your name in town are strong, less when they are not.'}
                </div>
              </>
            );
          })()}
        </>
      )}
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
  const [tab, setTab] = useState<'base' | 'stock' | 'shop' | 'buy'>('base');
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
        <button className="tt-btn sm" data-on={tab === 'base'} onClick={() => setTab('base')}>
          Base
        </button>
        <button className="tt-btn sm" data-on={tab === 'stock'} onClick={() => setTab('stock')}>
          Stock
        </button>
        <button className="tt-btn sm" data-on={tab === 'shop'} onClick={() => setTab('shop')}>
          Gear shop
        </button>
        <button className="tt-btn sm" data-on={tab === 'buy'} onClick={() => setTab('buy')}>
          Vehicles
        </button>
      </div>
      {tab === 'base' ? (
        <BaseOverview ctx={ctx} depot={depot} />
      ) : tab === 'shop' ? (
        <GearShop ctx={ctx} depot={depot} />
      ) : tab === 'stock' ? (
        <>
          <h4>Gear on the racks</h4>
          <WarehouseGear ctx={ctx} depot={depot} />
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
                    {m.gearCapacity} gear · {m.crewSeats} seats · {distance(m.speed * 24)}/day · {kmoney(m.runningCostPerYear)}/yr
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span className="tt-dim" style={{ fontSize: 11 }}>
                      Reliability
                    </span>
                    <Bar value={m.reliability} max={100} color="#4ade80" />
                  </div>
                </div>
                <button
                  className="tt-btn sm"
                  title={`Lease: no capital up front, ${money(leaseMonthly(id))} a month (${LEASE_TERM_MONTHS}-month term)`}
                  disabled={state.company.cash < leaseMonthly(id) || !canBaseVehicle(depot, m.kind)}
                  onClick={() => act(s => leaseVehicle(s, depot.id, id))}
                >
                  {money(leaseMonthly(id))}/mo
                </button>
                <button
                  className="tt-btn sm primary"
                  disabled={state.company.cash < m.price || !canBaseVehicle(depot, m.kind)}
                  title={canBaseVehicle(depot, m.kind) ? undefined : 'Delegations have no loading dock — vans and crew buses only'}
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
                  {d.kind === 'delegation' ? '🏢' : '🏭'} {world.cityById.get(d.cityId)?.name}
                  {d.cityId === state.company.hqCityId ? ' (HQ)' : ''} <span className="tt-dim">· {facilitySpec(d).label}</span>
                </div>
                <div className="tt-dim">
                  {units}/{facilitySpec(d).capacity} units · {d.staff.warehouse + d.staff.office} staff · {d.crew} gig techs ·{' '}
                  {state.vehicles.filter(v => v.owner === 'player' && v.homeCityId === d.cityId).length} vehicles
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="tt-dim" style={{ marginTop: 8 }}>
        To open a delegation or a warehouse, click any town on the map. Bases near the work cut fuel and hotel bills and make local
        freelancers cheaper; each one adds rent and salaries.
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
                {formatPopulation(populationOf(state, c))} · {ratingLabel(rating)}
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
