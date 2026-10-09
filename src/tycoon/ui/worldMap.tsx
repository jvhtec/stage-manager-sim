import { useMemo, useState } from 'react';
import { dayOf, formatDay, lastShowDay, yearOf } from '@/world/core';
import { estimatePaperwork } from '@/world/paperwork';
import { getRegion } from '@/world/content/world';
import { CITY_COORDS, HOME_HUB, LAND, type LonLat } from '@/world/content/worldmap';
import { tourGigs } from '@/world/tours';
import type { Gig, Tour, TycoonState } from '@/world/types';
import { money } from './format';
import type { WinCtx } from './types';

const LEG_COLORS = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#f472b6'];
const ASPECT = 2;
// x = lon, y = -lat. The whole world, trimmed to the inhabited latitudes.
const WORLD_BOX = { x: -180, y: -80, w: 360, h: 138 };

type Box = { x: number; y: number; w: number; h: number };

/** A viewBox around some points, padded and held to the map's aspect ratio. */
function fitBox(points: LonLat[]): Box {
  if (!points.length) return WORLD_BOX;
  const xs = points.map(p => p[0]);
  const ys = points.map(p => -p[1]);
  const pad = 14;
  let w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  let h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  w = Math.max(w, 56);
  h = Math.max(h, w / ASPECT);
  if (w / h < ASPECT) w = h * ASPECT;
  else h = w / ASPECT;
  w = Math.min(w, WORLD_BOX.w);
  h = w / ASPECT;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { x: Math.max(-180, Math.min(180 - w, cx - w / 2)), y: Math.max(-85, Math.min(60 - h, cy - h / 2)), w, h };
}

const ringPath = (ring: LonLat[]) => `M${ring.map(([lo, la]) => `${lo},${-la}`).join('L')}Z`;

/** A flight path: a lifted curve between two points. */
function arc(a: LonLat, b: LonLat): string {
  const [x1, y1, x2, y2] = [a[0], -a[1], b[0], -b[1]];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  return `M${x1},${y1}Q${mx},${my - dist * 0.28} ${x2},${y2}`;
}

export const worldTours = (state: TycoonState): Tour[] =>
  state.tours
    .filter(t => t.kind === 'world' && (t.status === 'offer' || t.status === 'booked' || t.status === 'done'))
    .sort((a, b) => ['booked', 'offer', 'done'].indexOf(a.status) - ['booked', 'offer', 'done'].indexOf(b.status));

interface LegView {
  gig: Gig;
  color: string;
  label: string;
  stops: { n: number; city: string; venue: string; day: number; at: LonLat | undefined }[];
}

export function WorldMapWindow({ ctx, tourId }: { ctx: WinCtx; tourId?: string }) {
  const { state } = ctx;
  const tours = worldTours(state);
  const [picked, setPicked] = useState<string | undefined>(tourId);
  const tour = tours.find(t => t.id === (picked ?? tourId)) ?? tours[0];
  const [focus, setFocus] = useState<'all' | number>('all');
  const today = dayOf(state.hour);
  const hub = HOME_HUB[state.country];

  const { legs, homeDates } = useMemo(() => {
    if (!tour) return { legs: [] as LegView[], homeDates: [] as Gig[] };
    const gigs = tourGigs(state, tour);
    const overseas = gigs.filter(g => g.overseas).sort((a, b) => a.day - b.day);
    let n = 0;
    const legs: LegView[] = overseas.map((gig, i) => ({
      gig,
      color: LEG_COLORS[i % LEG_COLORS.length],
      label: getRegion(gig.overseas!.regionId).name,
      stops: gig.overseas!.stops.map(s => ({ n: ++n, city: s.city, venue: s.venue, day: s.day, at: CITY_COORDS[s.city] })),
    }));
    return { legs, homeDates: gigs.filter(g => !g.overseas) };
  }, [state, tour]);

  const allStops = legs.flatMap(l => l.stops);
  const nextStop = allStops.find(s => s.day >= today);
  const box = useMemo(() => {
    // The whole tour frames home and every stop; a leg frames just its stops, close enough to read the names.
    if (focus === 'all' || !legs[focus]) return fitBox([hub, ...legs.flatMap(l => l.stops.flatMap(s => (s.at ? [s.at] : [])))]);
    return fitBox(legs[focus].stops.flatMap(s => (s.at ? [s.at] : [])));
  }, [focus, legs, hub]);
  const k = Math.max(0.55, (box.w / 360) * 1.4); // scale for strokes, dots and text

  if (!tours.length) {
    return (
      <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
        No world tours on the books. When a world-tour offer turns up (from reputation 80, once you can book stadium-sized acts), its flights and dates are drawn here.
      </div>
    );
  }

  const played = allStops.filter(s => s.day < today).length;
  return (
    <div>
      {tours.length > 1 && (
        <div className="tt-tabs">
          {tours.map(t => (
            <button
              key={t.id}
              className="tt-btn sm"
              data-on={t.id === tour.id}
              onClick={() => {
                setPicked(t.id);
                setFocus('all');
              }}
            >
              {t.act}
            </button>
          ))}
        </div>
      )}
      <div className="tt-dim" style={{ marginBottom: 4, whiteSpace: 'normal' }}>
        <b style={{ color: '#fff' }}>{tour.name}</b> · {legs.length} leg{legs.length === 1 ? '' : 's'} abroad · {allStops.length} dates · {played}/{allStops.length} played
      </div>

      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        width="100%"
        style={{ display: 'block', borderRadius: 4, background: '#0e2a47', border: '1px solid rgba(255,255,255,0.15)' }}
        role="img"
        aria-label={`World map for ${tour.name}`}
      >
        {/* graticule */}
        {[-60, -30, 0, 30, 60].map(la => (
          <line key={`la${la}`} x1={-180} x2={180} y1={-la} y2={-la} stroke="rgba(255,255,255,0.07)" strokeWidth={0.3 * k} />
        ))}
        {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(lo => (
          <line key={`lo${lo}`} x1={lo} x2={lo} y1={-80} y2={60} stroke="rgba(255,255,255,0.07)" strokeWidth={0.3 * k} />
        ))}
        {LAND.map(l => (
          <path key={l.id} d={ringPath(l.ring)} fill="#3b6b4a" stroke="#27483a" strokeWidth={0.4 * k} strokeLinejoin="round" />
        ))}

        {/* flights: hub → first stop, between stops, and the way back */}
        {legs.map((leg, i) => {
          const pts = leg.stops.map(s => s.at).filter((p): p is LonLat => !!p);
          if (!pts.length) return null;
          const dim = focus !== 'all' && focus !== i;
          return (
            <g key={leg.gig.id} opacity={dim ? 0.25 : 1}>
              <path d={arc(hub, pts[0])} fill="none" stroke={leg.color} strokeWidth={0.9 * k} strokeDasharray={`${2.4 * k} ${1.6 * k}`} strokeLinecap="round" />
              {pts.slice(1).map((p, j) => (
                <path key={j} d={arc(pts[j], p)} fill="none" stroke={leg.color} strokeWidth={0.6 * k} strokeOpacity={0.8} />
              ))}
              <path d={arc(pts[pts.length - 1], hub)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.45 * k} strokeDasharray={`${1.2 * k} ${1.6 * k}`} />
            </g>
          );
        })}

        {/* home */}
        <g>
          <circle cx={hub[0]} cy={-hub[1]} r={2.4 * k} fill={state.company.color} stroke="#fff" strokeWidth={0.5 * k} />
          <text x={hub[0]} y={-hub[1] - 3.6 * k} fontSize={2.4 * k} fill="#fff" textAnchor="middle" fontWeight={700} style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.6)" strokeWidth={0.5 * k}>
            Home
          </text>
        </g>

        {/* stops */}
        {legs.map((leg, i) =>
          leg.stops.map(s => {
            if (!s.at) return null;
            const dim = focus !== 'all' && focus !== i;
            const done = s.day < today;
            const isNext = nextStop === s;
            return (
              <g key={`${leg.gig.id}-${s.n}`} opacity={dim ? 0.3 : 1}>
                {isNext && (
                  <circle cx={s.at[0]} cy={-s.at[1]} r={3 * k} fill="none" stroke="#fff" strokeWidth={0.5 * k}>
                    <animate attributeName="r" values={`${2.4 * k};${5 * k};${2.4 * k}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0;1" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={s.at[0]} cy={-s.at[1]} r={(focus === 'all' ? 2.2 : 2) * k} fill={done ? '#22c55e' : leg.color} stroke="#fff" strokeWidth={0.4 * k} />
                <text x={s.at[0]} y={-s.at[1] + 0.8 * k} fontSize={2.2 * k} fill="#0b1220" textAnchor="middle" fontWeight={800}>
                  {s.n}
                </text>
                {focus !== 'all' && (
                  <text x={s.at[0]} y={-s.at[1] - 3.4 * k} fontSize={2.3 * k} fill="#fff" textAnchor="middle" fontWeight={700} style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.65)" strokeWidth={0.5 * k}>
                    {s.city}
                  </text>
                )}
              </g>
            );
          }),
        )}
      </svg>

      <div className="tt-tabs" style={{ marginTop: 6 }}>
        <button className="tt-btn sm" data-on={focus === 'all'} onClick={() => setFocus('all')}>
          Whole tour
        </button>
        {legs.map((l, i) => (
          <button key={l.gig.id} className="tt-btn sm" data-on={focus === i} onClick={() => setFocus(i)} style={focus === i ? { borderColor: l.color } : undefined}>
            <span style={{ color: l.color }}>●</span> {l.label.replace(' leg', '')}
          </button>
        ))}
      </div>

      {homeDates.length > 0 && (
        <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
          At home first: {homeDates.map(g => formatDay(state, g.day)).join(', ')}.
        </div>
      )}
      {legs.map((leg, i) => {
        const region = getRegion(leg.gig.overseas!.regionId);
        const first = leg.stops[0];
        const last = leg.stops[leg.stops.length - 1];
        return (
          <div key={leg.gig.id}>
            <h4 style={{ cursor: 'pointer', color: leg.color }} onClick={() => setFocus(i)}>
              {leg.label} — {formatDay(state, first.day)} → {formatDay(state, lastShowDay(leg.gig))}
            </h4>
            {(() => {
              const pw = estimatePaperwork(state, leg.gig, yearOf(state, leg.gig.day * 24));
              return (
                <div className="tt-dim" style={{ marginBottom: 4, whiteSpace: 'normal' }}>
                  Paperwork (est.): {money(pw.total)} — carnet {pw.carnet ? money(pw.carnet) : 'not needed'}, visas {pw.visas ? money(pw.visas) : 'none'}
                  {pw.lines.some(l => l.visa) ? ` (${pw.lines.filter(l => l.visa).map(l => `${l.code} ${money(l.visa)}/head`).join(', ')})` : ''}
                </div>
              );
            })()}
            <div className="tt-dim" style={{ marginBottom: 4, whiteSpace: 'normal' }}>
              Rig flown out of the home airport: {region.freightDays} days each way · {money(region.freightPerUnit)} a unit and {money(region.flightPerCrew)} a head, round trip · {money(leg.gig.fee)} in fees
            </div>
            <div className="tt-list">
              {leg.stops.map(s => (
                <div key={s.n} className="tt-item" style={{ gap: 6 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 10, background: s.day < today ? '#22c55e' : leg.color, color: '#0b1220', fontWeight: 800, fontSize: 11, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {s.n}
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <b>{s.city}</b> <span className="tt-dim">— {s.venue}</span>
                  </div>
                  <span className="tt-dim">{s.day < today ? 'played' : s.day === today ? 'today' : formatDay(state, s.day)}</span>
                </div>
              ))}
            </div>
            <div className="tt-dim" style={{ marginTop: 2 }}>
              {last !== first ? `${first.city} → ${last.city}` : first.city}
              <a style={{ marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('gig', leg.gig.id)}>
                Open the leg ›
              </a>
            </div>
          </div>
        );
      })}
      <a style={{ display: 'inline-block', marginTop: 8, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => ctx.open('tour', tour.id)}>
        Open the tour ›
      </a>
    </div>
  );
}
