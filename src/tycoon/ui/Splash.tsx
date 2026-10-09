import { useEffect } from 'react';
import { formatHour } from '@/world/core';
import { GOALS } from '@/world/scenario';
import type { TycoonState } from '@/world/types';
import { money } from './format';

// Isometric helpers for the title truck: x runs along the truck (towards its nose), y across it, z up.
const ISO = { ox: 24, oy: 34, cx: 5.4, sy: 2.7, zs: 5.2 };
const iso = (x: number, y: number, z: number) => `${(ISO.ox + (x - y) * ISO.cx).toFixed(1)},${(ISO.oy + (x + y) * ISO.sy - z * ISO.zs).toFixed(1)}`;
const quad = (pts: [number, number, number][]) => pts.map(([x, y, z]) => iso(x, y, z)).join(' ');

/** A box with a lit top, a side (+y) and a front (+x) face. */
function Block({ x0, x1, y0, y1, z0, z1, top, side, front }: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; top: string; side: string; front: string }) {
  return (
    <g>
      <polygon points={quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])} fill={side} />
      <polygon points={quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]])} fill={front} />
      <polygon points={quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])} fill={top} />
    </g>
  );
}

/** A wheel standing on the +y face of the truck (plane y = `y`). */
function Wheel({ x, y, r }: { x: number; y: number; r: number }) {
  const ring = (rad: number) =>
    Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return iso(x + Math.cos(a) * rad, y, r + Math.sin(a) * rad);
    }).join(' ');
  return (
    <g>
      <polygon points={ring(r)} fill="#0f172a" />
      <polygon points={ring(r * 0.55)} fill="#94a3b8" />
      <polygon points={ring(r * 0.2)} fill="#334155" />
    </g>
  );
}

/** A small isometric box truck in company colours, for the title card. */
function TitleTruck({ color }: { color: string }) {
  const W = 3; // width
  return (
    <svg viewBox="0 0 96 76" width="150" aria-hidden="true" className="tt-splash-truck">
      <ellipse cx="46" cy="56" rx="40" ry="9" fill="rgba(0,0,0,0.35)" />
      {/* chassis */}
      <Block x0={0.2} x1={10.2} y0={0.3} y1={W - 0.3} z0={1.2} z1={1.9} top="#475569" side="#1f2937" front="#111827" />
      {/* cargo box */}
      <Block x0={0} x1={7.2} y0={0} y1={W} z0={1.9} z1={6} top="#f1f5f9" side="#d5dae4" front="#b3bac8" />
      {/* company band along the side and a thin roof stripe */}
      <polygon points={quad([[0, W, 3.1], [7.2, W, 3.1], [7.2, W, 4.5], [0, W, 4.5]])} fill={color} />
      <polygon points={quad([[0.4, W, 5.4], [6.8, W, 5.4], [6.8, W, 5.6], [0.4, W, 5.6]])} fill={color} opacity="0.55" />
      {/* cab */}
      <Block x0={7.4} x1={10.2} y0={0} y1={W} z0={1.9} z1={4.7} top="#ffffff" side={color} front={color} />
      {/* windows: side + windscreen */}
      <polygon points={quad([[8.0, W, 3.0], [9.8, W, 3.0], [9.8, W, 4.3], [8.0, W, 4.3]])} fill="#1e293b" />
      <polygon points={quad([[10.2, 0.4, 3.0], [10.2, W - 0.4, 3.0], [10.2, W - 0.4, 4.3], [10.2, 0.4, 4.3]])} fill="#1e293b" />
      <polygon points={quad([[10.2, 0.4, 4.3], [10.2, W - 0.4, 4.3], [10.2, W - 0.4, 4.45], [10.2, 0.4, 4.45]])} fill="#ffffff" opacity="0.35" />
      {/* bumper + lights */}
      <polygon points={quad([[10.3, 0, 1.6], [10.3, W, 1.6], [10.3, W, 2.3], [10.3, 0, 2.3]])} fill="#e2e8f0" />
      <polygon points={quad([[10.31, 0.25, 2.5], [10.31, 0.75, 2.5], [10.31, 0.75, 2.85], [10.31, 0.25, 2.85]])} fill="#fde68a" />
      <polygon points={quad([[10.31, W - 0.75, 2.5], [10.31, W - 0.25, 2.5], [10.31, W - 0.25, 2.85], [10.31, W - 0.75, 2.85]])} fill="#fde68a" />
      {/* wheels on the near side */}
      <Wheel x={1.9} y={W + 0.02} r={1.15} />
      <Wheel x={4.6} y={W + 0.02} r={1.15} />
      <Wheel x={8.9} y={W + 0.02} r={1.15} />
    </svg>
  );
}

/** The front door: title, what's saved, and where to go. */
export function Splash({
  saved,
  color,
  onContinue,
  onNew,
  onHelp,
}: {
  saved: TycoonState | null;
  color: string;
  onContinue: () => void;
  onNew: () => void;
  onHelp: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      (saved && !saved.gameOver ? onContinue : onNew)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saved, onContinue, onNew]);

  return (
    <div className="tt-splash" role="dialog" aria-label="Stage Tycoon">
      <div className="tt-splash-beams" aria-hidden="true">
        <i style={{ left: '12%', animationDelay: '0s' }} />
        <i style={{ left: '34%', animationDelay: '-2.2s' }} />
        <i style={{ left: '62%', animationDelay: '-4.1s' }} />
        <i style={{ left: '84%', animationDelay: '-1.3s' }} />
      </div>
      <div className="tt-splash-card">
        <div className="tt-splash-kicker">Stage Manager Sim presents</div>
        <h1 className="tt-splash-title">
          <span>STAGE</span>
          <b>TYCOON</b>
        </h1>
        <TitleTruck color={color} />
        <p className="tt-splash-tag">Build a touring production company. Sound, lights, trucks and the open road — from 1975 to today.</p>

        <div className="tt-splash-menu">
          {saved && (
            <button className="tt-btn primary tt-splash-btn" onClick={onContinue} autoFocus>
              <span>{saved.gameOver ? 'See how it ended' : 'Continue'}</span>
              <small>
                {saved.company.name} · {formatHour(saved, saved.hour)} · {money(saved.company.cash)}
                {saved.goal && saved.goal !== 'sandbox' ? ` · ${GOALS[saved.goal].label}` : ''}
              </small>
            </button>
          )}
          <button className={`tt-btn tt-splash-btn${saved ? '' : ' primary'}`} onClick={onNew} autoFocus={!saved}>
            <span>New company</span>
            <small>Pick a country, a year, a goal</small>
          </button>
          <button className="tt-btn tt-splash-btn" onClick={onHelp}>
            <span>How to play</span>
            <small>The short version</small>
          </button>
        </div>

        <div className="tt-splash-foot">
          <a href={`${import.meta.env.BASE_URL}classic`}>Classic version</a>
          <span>·</span>
          <span>Inspired by Transport Tycoon · made with Claude</span>
        </div>
      </div>
    </div>
  );
}
