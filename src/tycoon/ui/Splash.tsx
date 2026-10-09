import { useEffect } from 'react';
import { formatHour } from '@/world/core';
import { GOALS } from '@/world/scenario';
import type { TycoonState } from '@/world/types';
import { money } from './format';

/** A small isometric box truck in company colours, for the title card. */
function TitleTruck({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 70" width="132" aria-hidden="true" className="tt-splash-truck">
      <ellipse cx="60" cy="58" rx="46" ry="8" fill="rgba(0,0,0,0.35)" />
      {/* box */}
      <polygon points="14,26 58,10 58,44 14,60" fill="#d9dde6" />
      <polygon points="58,10 82,20 82,54 58,44" fill="#aeb4c2" />
      <polygon points="14,26 58,10 82,20 38,36" fill="#eef0f5" />
      <polygon points="14,40 58,24 58,32 14,48" fill={color} />
      <polygon points="58,24 82,34 82,40 58,32" fill={color} opacity="0.8" />
      {/* cab */}
      <polygon points="82,30 100,38 100,58 82,50" fill={color} />
      <polygon points="82,30 90,26 106,34 100,38" fill="#ffffff" opacity="0.5" />
      <polygon points="92,36 100,39 100,46 92,43" fill="#1e293b" />
      {/* wheels */}
      <ellipse cx="34" cy="55" rx="7" ry="4" fill="#111827" />
      <ellipse cx="70" cy="49" rx="7" ry="4" fill="#111827" />
      <ellipse cx="94" cy="55" rx="6" ry="3.5" fill="#111827" />
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
