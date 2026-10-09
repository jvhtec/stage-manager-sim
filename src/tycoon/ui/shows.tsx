import { gigBookingBar } from '@/world/standing';
import { useState } from 'react';
import { assignVehicle, bookGate, bookGig, haggleGig, rehearseShow, unassignVehicle } from '@/world/actions';
import { MODULES, REHEARSAL_QUALITY, bestStageLevel, gigRehearsalCost, rehearsalBlocker, tourRehearsalCost } from '@/world/annexes';
import { expectedPayout, gateBlocker, gatePayout, hypeLabel } from '@/world/gate';
import { HAGGLE_RAISE, haggleBlocker, haggleChance } from '@/world/negotiate';
import { DEPT_COLORS, DEPT_LABELS, LOAD_IN_HOUR, SHOW_END_HOUR, SHOW_START_HOUR, getModel } from '@/world/catalog';
import { dateOfDay, dayOf, formatDay, formatHour, loadInHour, loadOutDoneHour, sumCounts } from '@/world/core';
import { getRegion } from '@/world/content/world';
import { artistTierIn, findArtist } from '@/world/content/artists';
import { expectedQuality } from '@/world/content/gear';
import { averageCondition, failureChance } from '@/world/wear';
import { prepFailureFactor } from '@/world/facilities';
import { levelOf } from '@/world/people';
import { CrewPicker } from './crewWindow';
import { ConditionChip } from './gear';
import { ContractList } from './contracts';
import { EventBid, EventList } from './events';
import { getTech } from '@/world/content/techs';
import { worldOf } from '@/world/mapgen';
import { roadDistance } from '@/world/pathfinding';
import { estimateArrival, estimateJobCosts, projectCoverage } from '@/world/queries';
import { DEPTS, type Gig, type TycoonState } from '@/world/types';
import { Bar, Stat, TierChip } from './bits';
import { BrandBadge } from './brands';
import { kmoney, money } from './format';
import type { WinCtx } from './types';
import { READINESS_CLASS, gigDates, gigReadiness, gigWhere } from './gigInfo';
import { TourList } from './tours';

function nearestDepotDistance(state: TycoonState, gig: Gig): number {
  const world = worldOf(state);
  return Math.min(...state.depots.map(d => roadDistance(world, d.cityId, gig.cityId)));
}

export function GigWindow({ ctx, gigId }: { ctx: WinCtx; gigId: string }) {
  const { state } = ctx;
  const [pickingCrew, setPickingCrew] = useState(false);
  const gig = state.gigs.find(g => g.id === gigId);
  if (!gig) return <div className="tt-dim">This show has dropped off the books.</div>;
  const world = worldOf(state);
  const venue = world.venueById.get(gig.venueId)!;
  const city = world.cityById.get(gig.cityId)!;
  const today = dayOf(state.hour);
  const lock = gigBookingBar(state, gig).reason;
  const locked = !!lock;
  const act = (fn: Parameters<WinCtx['dispatch']>[0]) => {
    const r = ctx.dispatch(fn);
    if (r.message) ctx.toast(r.message, r.ok);
  };

  const projection = gig.status === 'booked' ? projectCoverage(state, gig) : null;
  const shown = projection?.gear;
  const gearNeed = sumCounts(gig.needs);
  const gearHave = shown ? DEPTS.reduce((s, d) => s + Math.min(shown[d], gig.needs[d]), 0) : 0;
  const rival = state.rivals.find(r => r.id === gig.rivalId);
  const candidates = state.vehicles.filter(v => v.owner === 'player' && !v.orders.includes(gig.id));
  const artist = findArtist(gig.act);
  const tour = gig.tourId ? state.tours.find(t => t.id === gig.tourId) : undefined;
  const region = gig.overseas ? getRegion(gig.overseas.regionId) : undefined;
  const gigYear = dateOfDay(state, gig.day).getUTCFullYear();
  const artistTierLabel = artist ? `currently touring ${['', 'pubs', 'clubs & theatres', 'arenas', 'stadiums'][artistTierIn(artist, gigYear)] ?? ''}` : '';

  return (
    <div>
      <div className="tt-row">
        <span>
          {gig.festival && <b>🎪 {gig.festival.stage} · </b>}
          <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('venue', venue.id)}>
            {gig.festival ? 'festival site' : venue.name}
          </a>
          ,{' '}
          <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('city', city.id)}>
            {city.name}
          </a>
        </span>
        <TierChip tier={gig.tier} locked={locked && gig.status === 'offer'} />
      </div>
      <Stat label={(gig.days ?? 1) > 1 ? `Show days (${gig.days})` : 'Show day'}>
        {gigDates(state, gig)}{' '}
        <span className="tt-dim">({gig.day - today >= 0 ? `in ${gig.day - today}d` : `${today - gig.day}d ago`})</span>
      </Stat>
      {gig.event && (
        <div className="tt-item" style={{ margin: '4px 0' }}>
          <span className="grow" style={{ whiteSpace: 'normal' }}>
            {gig.event.citywide ? '🎉' : gig.event.broadcast ? '📺' : '★'} {gig.event.citywide ? `Part of ${gig.event.name}` : <>
              <b>{DEPT_LABELS[gig.event.lot]}</b> contract for <b>{gig.event.name}</b>
            </>}
          </span>
        </div>
      )}
      {tour && (
        <div className="tt-item clickable" style={{ margin: '4px 0' }} onClick={() => ctx.open('tour', tour.id)}>
          <span className="grow">
            {tour.kind === 'world' ? '🌍' : '🎫'} Part of <b>{tour.name}</b>
          </span>
          <span className="tt-dim">open ›</span>
        </div>
      )}
      {region && gig.overseas ? (
        <>
          <div className="tt-list" style={{ margin: '4px 0' }}>
            {gig.overseas.stops.map(st => (
              <div key={st.city} className="tt-row">
                <span>
                  {st.venue}, {st.city} <span className="tt-dim">({st.country})</span>
                </span>
                <span className="tt-dim">{formatDay(state, st.day)}</span>
              </div>
            ))}
          </div>
          <Stat label="Rig at airport by">{formatHour(state, loadInHour(gig))}</Stat>
          <Stat label="Freight back">{formatHour(state, loadOutDoneHour(gig))}</Stat>
          <Stat label="Freight + flights">
            ≈ {money(sumCounts(gig.needs) * region.freightPerUnit + gig.crewNeeded * region.flightPerCrew)}
          </Stat>
        </>
      ) : (
        <Stat label="Timetable">
          Load-in {LOAD_IN_HOUR}:00 · Show {SHOW_START_HOUR}:00–{SHOW_END_HOUR}:00
        </Stat>
      )}
      <Stat label="Fee">
        <b>{money(gig.fee)}</b>
      </Stat>
      {(artist || gig.asksForYou) && (
        <div className="tt-row" style={{ marginTop: 2 }}>
          <span className="tt-dim">{artist ? `${artist.genre} · ${artistTierLabel}` : ''}</span>
          {gig.asksForYou && (
            <span className="tt-chip" style={{ background: '#fda4af' }} title="You've done great shows for them before — rivals are less likely to steal this one">
              ♥ Asked for you
            </span>
          )}
        </div>
      )}
      <Stat label="Kit expected">Quality {expectedQuality(gig.tier, gigYear).toFixed(1)}+</Stat>
      {gig.rider && (
        <Stat label="Rider asks for">
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <BrandBadge brand={gig.rider.brand} /> {DEPT_LABELS[gig.rider.dept].toLowerCase()}
          </span>
        </Stat>
      )}
      {gig.status === 'offer' && (
        <Stat label="Book by">
          {formatDay(state, gig.acceptByDay)}{' '}
          <span className="tt-dim">· {Math.round(nearestDepotDistance(state, gig))} tiles from your nearest depot</span>
        </Stat>
      )}

      <h4>Requirements</h4>
      <div className="tt-grid">
        {DEPTS.filter(d => gig.needs[d] > 0).map(d => (
          <Row key={d} label={DEPT_LABELS[d]} color={DEPT_COLORS[d]} need={gig.needs[d]} have={shown?.[d]} />
        ))}
        <Row label="Crew" color="#e5e7eb" need={gig.crewNeeded} have={projection?.crew} />
      </div>

      {gig.status === 'offer' && gig.event && !gig.event.citywide && <EventBid ctx={ctx} gig={gig} />}
      {gig.status === 'offer' && !(gig.event && !gig.event.citywide) && (
        <div style={{ marginTop: 10 }}>
          {locked ? (
            <div className="tt-warn">
              {lock} You have {Math.round(state.company.reputation)}.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="tt-btn primary" onClick={() => act(s => bookGig(s, gig.id))}>
                {tour ? 'Book the whole tour' : 'Book this show'}
              </button>
              {!tour && !gateBlocker(gig) && (
                <button
                  className="tt-btn"
                  title={`Instead of ${money(gig.fee)} flat: ${money(Math.round(gatePayout(gig.fee, 0.9, 1)))} for a great show on a normal night, ${money(Math.round(gatePayout(gig.fee, 0.9, 1.4)))} if it sells out, ${money(Math.round(gatePayout(gig.fee, 0.6, 0.7)))} for an average show and slow tickets`}
                  onClick={() => act(s => bookGate(s, gig.id))}
                >
                  Share of the gate
                </button>
              )}
              {!tour && !haggleBlocker(state, gig) && (
                <button
                  className="tt-btn"
                  title={`Push for +${Math.round(HAGGLE_RAISE * 100)}% — ${Math.round(haggleChance(state, gig) * 100)}% they agree; if not, they may walk away`}
                  onClick={() => act(s => haggleGig(s, gig.id))}
                >
                  Haggle +{Math.round(HAGGLE_RAISE * 100)}% ({Math.round(haggleChance(state, gig) * 100)}%)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {gig.gate && (
        <Stat label="Deal">
          Share of the gate <span className="tt-dim">· tickets forecast {hypeLabel(gig.gate.forecast)}{gig.status === 'booked' ? ' — the real number comes on the night' : ''}</span>
        </Stat>
      )}
      {gig.status === 'booked' && gig.rehearsed && (
        <Stat label="Rehearsed">
          <span className="tt-good">in your {MODULES.rehearsal.levels[gig.rehearsed - 1].label.toLowerCase()}</span>
        </Stat>
      )}
      {gig.status === 'booked' && !gig.rehearsed && bestStageLevel(state) > 0 && (
        <div style={{ marginTop: 6 }}>
          {(() => {
            const id = tour ? tour.id : gig.id;
            const why = rehearsalBlocker(state, id);
            const cost = tour ? tourRehearsalCost(state, tour) : gigRehearsalCost(gig);
            return (
              <button
                className="tt-btn sm"
                disabled={!!why}
                title={why ?? `Run it through your stage: quality +${Math.round(REHEARSAL_QUALITY[bestStageLevel(state)] * 100)}%, fewer failures`}
                onClick={() => act(s => rehearseShow(s, id))}
              >
                {tour ? 'Rehearse the tour' : 'Rehearse'} · {money(cost)}
              </button>
            );
          })()}
          {rehearsalBlocker(state, tour ? tour.id : gig.id) && <span className="tt-dim"> {rehearsalBlocker(state, tour ? tour.id : gig.id)}</span>}
        </div>
      )}
      {gig.status === 'booked' && projection && (
        <>
          <div className="tt-item" style={{ marginTop: 8 }}>
            <span className="grow">
              {projection.vehicles.length === 0 ? (
                <span className="tt-bad">No vehicles assigned — this will be a no-show.</span>
              ) : !projection.onTime ? (
                <span className="tt-bad">Won't make load-in! Last arrival {formatHour(state, projection.latestArrival)}.</span>
              ) : gearHave < gearNeed || projection.crew < gig.crewNeeded ? (
                <span className="tt-warn">
                  Short: {gearHave}/{gearNeed} gear, {projection.crew}/{gig.crewNeeded} crew.
                </span>
              ) : (
                <span className="tt-good">Fully covered and on time.</span>
              )}
            </span>
          </div>
          {projection.vehicles.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <button className="tt-btn sm" onClick={() => setPickingCrew(p => !p)} style={{ marginBottom: 6 }}>
                {pickingCrew ? 'Hide crew' : `Choose the crew${gig.crewPicks?.length ? ` (${gig.crewPicks.length} named)` : ''}`}
              </button>
              {pickingCrew && <CrewPicker ctx={ctx} gig={gig} />}
              <Stat label="Kit vs expectations">
                <span className={projection.evaluation.quality >= 0.95 ? 'tt-good' : projection.evaluation.quality >= 0.8 ? 'tt-warn' : 'tt-bad'}>
                  {Math.round(projection.evaluation.quality * 100)}%
                </span>
              </Stat>
              <Stat label="Kit condition">
                <ConditionChip value={averageCondition(state, projection.delivered)} />{' '}
                <span className="tt-dim">
                  {Math.round(
                    (1 -
                      (1 - Math.min(0.95, failureChance(averageCondition(state, projection.delivered)) * prepFailureFactor(projection.prep) * projection.crewEval.failureFactor)) **
                        Math.min(4, gig.overseas ? gig.overseas.stops.length : (gig.days ?? 1))) *
                      100,
                  )}
                  % failure risk
                </span>
              </Stat>
              {projection.people.length > 0 && (
                <Stat label="Crew fit">
                  <span className={projection.crewEval.match >= 0.75 ? 'tt-good' : projection.crewEval.match >= 0.55 ? 'tt-warn' : 'tt-bad'}>
                    {Math.round(projection.crewEval.match * 100)}%
                  </span>{' '}
                  <span className="tt-dim">
                    {projection.people
                      .map(m => `${m.name.split(' ')[0]} ${levelOf(m)}★`)
                      .slice(0, 6)
                      .join(', ')}
                    {projection.people.length > 6 ? '…' : ''}
                  </span>
                </Stat>
              )}
              <Stat label="Prep">
                <span className={projection.prep >= 1 ? 'tt-good' : projection.prep >= 0.5 ? 'tt-warn' : 'tt-bad'}>
                  {Math.round(projection.prep * 100)}%
                </span>
              </Stat>
              {projection.subhire.units > 0 && (
                <Stat label="Sub-hire">
                  {projection.subhire.units} unit{projection.subhire.units > 1 ? 's' : ''} · {money(projection.subhire.cost)}{' '}
                  <span className="tt-dim">from {projection.subhire.from.join(' / ')}</span>
                </Stat>
              )}
              {projection.freelance.count > 0 && (
                <Stat label="Local freelancers">
                  +{projection.freelance.count} · {money(projection.freelance.cost)}
                  {projection.freelance.local ? ' (your contacts)' : ''}
                </Stat>
              )}
              {(() => {
                const c = estimateJobCosts(state, gig, projection);
                return (
                  <>
                    <Stat label="Road costs (est.)">
                      {money(c.total)}{' '}
                      <span className="tt-dim">
                        fuel {money(c.fuel)} · {c.nights} night{c.nights === 1 ? '' : 's'} away {money(c.travel)}
                        {c.freelance ? ` · freelancers ${money(c.freelance)}` : ''}
                        {c.subhire ? ` · sub-hire ${money(c.subhire)}` : ''}
                        {c.paperwork ? ` · visas & carnet ${money(c.paperwork)}` : ''}
                        {c.zones ? ` · low-emission zone ${money(c.zones)}` : ''}
                      </span>
                    </Stat>
                    <Stat label="Margin (est.)">
                      <b className={expectedPayout(gig, projection.expectedQuality) - c.total >= 0 ? 'tt-good' : 'tt-bad'}>
                        {money(Math.round(expectedPayout(gig, projection.expectedQuality) - c.total))}
                      </b>
                    </Stat>
                  </>
                );
              })()}
              {gig.rider && (
                <Stat label="Rider">
                  {projection.evaluation.riderMet ? (
                    <span className="tt-good">✓ {gig.rider.brand} going out</span>
                  ) : (
                    <span className="tt-bad">✗ no {gig.rider.brand} loaded</span>
                  )}
                </Stat>
              )}
              {projection.techIds.length > 0 && (
                <Stat label="Star techs">
                  {projection.techIds.map(id => getTech(id).name).join(', ')}
                  {projection.techIds.some(id => getTech(id).knownFor.includes(gig.act)) ? ' ♥' : ''}
                </Stat>
              )}
              <Stat label="Expected show">
                <b>{Math.round(projection.expectedQuality * 100)}%</b>
              </Stat>
            </div>
          )}
          <h4>Assigned</h4>
          <div className="tt-list">
            {projection.vehicles.map(v => {
              const eta = estimateArrival(state, v, gig);
              const late = eta > loadInHour(gig);
              return (
                <div key={v.id} className="tt-item clickable" onClick={() => ctx.open('vehicle', v.id)}>
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{v.name}</div>
                    <div className={late ? 'tt-bad' : 'tt-dim'}>ETA {formatHour(state, eta)}</div>
                  </div>
                  <button
                    className="tt-btn sm"
                    onClick={e => {
                      e.stopPropagation();
                      act(s => unassignVehicle(s, v.id, gig.id));
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {!projection.vehicles.length && <div className="tt-dim">None yet.</div>}
          </div>
          <h4>Add a vehicle</h4>
          <div className="tt-list">
            {candidates.map(v => {
              const m = getModel(v.modelId);
              const eta = estimateArrival(state, v, gig);
              const late = eta > loadInHour(gig);
              const busy = v.orders.length > 0;
              return (
                <div key={v.id} className="tt-item">
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>
                      {v.name} <span className="tt-dim">{m.name}</span>
                    </div>
                    <div className="tt-dim">
                      {m.gearCapacity} gear · {m.crewSeats} seats · {world.cityById.get(v.homeCityId)?.name}
                      {busy ? ` · ${v.orders.length} job${v.orders.length > 1 ? 's' : ''} before` : ''}
                    </div>
                    <div className={late ? 'tt-bad' : 'tt-good'} style={{ fontSize: 11.5 }}>
                      {Number.isFinite(eta) ? `ETA ${formatHour(state, eta)}${late ? ' — late!' : ''}` : 'No road'}
                    </div>
                  </div>
                  <button className="tt-btn sm primary" disabled={!Number.isFinite(eta)} onClick={() => act(s => assignVehicle(s, v.id, gig.id))}>
                    + Assign
                  </button>
                </div>
              );
            })}
            {!candidates.length && <div className="tt-dim">Every vehicle is already on this job.</div>}
          </div>
        </>
      )}

      {gig.result && gig.status !== 'rival' && (
        <>
          <h4>Result</h4>
          <Stat label="Show quality">
            <b className={gig.status === 'done' ? 'tt-good' : 'tt-bad'}>{Math.round(gig.result.quality * 100)}%</b>
          </Stat>
          <Stat label="Gear delivered">{Math.round(gig.result.gearCoverage * 100)}%</Stat>
          <Stat label="Crew delivered">{Math.round(gig.result.crewCoverage * 100)}%</Stat>
          <Stat label="Late to load-in">{gig.result.lateHours ? `${gig.result.lateHours}h` : 'On time'}</Stat>
          {gig.result.gearQuality !== undefined && <Stat label="Kit vs expectations">{Math.round(gig.result.gearQuality * 100)}%</Stat>}
          {gig.result.riderMet !== undefined && (
            <Stat label="Rider">{gig.result.riderMet ? <span className="tt-good">Honoured</span> : <span className="tt-bad">Not met</span>}</Stat>
          )}
          <Stat label={gig.result.payout >= 0 ? 'Paid' : 'Penalty'}>
            <b className={gig.result.payout >= 0 ? 'tt-good' : 'tt-bad'}>{money(gig.result.payout)}</b>
          </Stat>
        </>
      )}
      {gig.status === 'rival' && rival && (
        <div style={{ marginTop: 8 }}>
          Won by <b style={{ color: rival.color }}>{rival.name}</b>.
        </div>
      )}
      {gig.status === 'expired' && <div className="tt-dim" style={{ marginTop: 8 }}>Nobody booked it in time.</div>}

      <div style={{ marginTop: 10 }}>
        <button className="tt-btn sm" onClick={() => ctx.goTo(venue.x + venue.w / 2, venue.y + venue.h / 2)}>
          Show on map
        </button>
      </div>
    </div>
  );
}

function Row({ label, color, need, have }: { label: string; color: string; need: number; have?: number }) {
  return (
    <>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
        {label}
      </span>
      {have === undefined ? <span /> : <Bar value={have} max={need} color={have >= need ? '#4ade80' : '#fbbf24'} />}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {have === undefined ? need : `${Math.min(have, need)}/${need}`}
      </span>
    </>
  );
}

export function ShowsWindow({ ctx }: { ctx: WinCtx }) {
  const { state } = ctx;
  const [tab, setTab] = useState<'offers' | 'tours' | 'events' | 'contracts' | 'booked' | 'history'>('offers');
  const today = dayOf(state.hour);
  const isLocked = (g: Gig) => Number(!!gigBookingBar(state, g).reason);
  const offers = state.gigs
    .filter(g => g.status === 'offer' && g.acceptByDay >= today && !g.tourId)
    .sort((a, b) => isLocked(a) - isLocked(b) || nearestDepotDistance(state, a) - nearestDepotDistance(state, b));
  const booked = state.gigs.filter(g => g.status === 'booked').sort((a, b) => a.day - b.day);
  const history = state.gigs
    .filter(g => g.status === 'done' || g.status === 'failed')
    .sort((a, b) => b.day - a.day);
  const list = tab === 'offers' ? offers : tab === 'booked' ? booked : history;

  return (
    <div>
      <div className="tt-tabs">
        <button className="tt-btn sm" data-on={tab === 'offers'} onClick={() => setTab('offers')}>
          Offers ({offers.length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'tours'} onClick={() => setTab('tours')}>
          Tours ({state.tours.filter(t => (t.status === 'offer' && t.acceptByDay >= today) || t.status === 'booked').length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'events'} onClick={() => setTab('events')}>
          Events ({state.gigs.filter(g => g.event && !g.event.citywide && g.status === 'offer' && g.acceptByDay >= today).length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'contracts'} onClick={() => setTab('contracts')}>
          Contracts ({state.contracts.filter(c => c.status === 'active' || (c.status === 'offer' && c.acceptByDay >= today)).length + state.deals.filter(d => d.status === 'offer' || d.status === 'active').length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'booked'} onClick={() => setTab('booked')}>
          Booked ({booked.length})
        </button>
        <button className="tt-btn sm" data-on={tab === 'history'} onClick={() => setTab('history')}>
          History
        </button>
      </div>
      {tab === 'tours' ? (
        <TourList ctx={ctx} />
      ) : tab === 'events' ? (
        <EventList ctx={ctx} />
      ) : tab === 'contracts' ? (
        <ContractList ctx={ctx} />
      ) : (
      <div className="tt-list">
        {list.map(g => {
          const dist = nearestDepotDistance(state, g);
          let right: React.ReactNode = <b>{kmoney(g.fee)}</b>;
          if (tab === 'booked') {
            const r = gigReadiness(state, g);
            right = (
              <span className={READINESS_CLASS[r]} style={{ fontWeight: 800 }}>
                {r}
              </span>
            );
          } else if (tab === 'history') {
            right = (
              <span className={g.status === 'done' ? 'tt-good' : 'tt-bad'} style={{ fontWeight: 800 }}>
                {money(g.result?.payout ?? 0)}
              </span>
            );
          }
          return (
            <div key={g.id} className="tt-item clickable" onClick={() => ctx.open('gig', g.id)}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>
                  {g.asksForYou ? '♥ ' : ''}
                  {g.act}
                </div>
                <div className="tt-dim">
                  {g.tourId ? '🎫 ' : ''}
                  {gigWhere(state, g)} · {gigDates(state, g)}
                  {tab === 'offers' ? ` · ${Math.round(dist)} tiles` : ''}
                </div>
              </div>
              {tab === 'offers' && <TierChip tier={g.tier} locked={!!isLocked(g)} />}
              {right}
            </div>
          );
        })}
        {!list.length && <div className="tt-dim">Nothing here yet.</div>}
      </div>
      )}
    </div>
  );
}
