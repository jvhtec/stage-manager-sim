import type { MapOverlay } from '../render/renderer';
import type { TycoonState } from '@/world/types';

const INFO: Record<Exclude<MapOverlay, 'none'>, { title: string; blurb: string }> = {
  rating: {
    title: 'Your reputation by town',
    blurb: 'How each town rates you (0-100). Good shows raise it, failures sink it; a high rating brings more offers there.',
  },
  share: {
    title: 'Your market share',
    blurb: "Your share of the shows played in each town lately (last year's count for less). Grey: nobody has worked there yet.",
  },
  rivals: {
    title: 'Whose patch is it?',
    blurb: 'The company that has played the most shows in each town lately, in its colour, and its share.',
  },
};

/** The key for the map's data view, with a button to switch it off. */
export function OverlayLegend({ overlay, state, onClose }: { overlay: MapOverlay; state: TycoonState | null; onClose: () => void }) {
  if (overlay === 'none') return null;
  const info = INFO[overlay];
  const swatch = (c: string) => <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: c, marginRight: 4 }} />;
  return (
    <div className="tt-legend tt-bevel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <b>{info.title}</b>
        <button className="tt-btn sm" onClick={onClose} aria-label="Hide map view">
          ✕
        </button>
      </div>
      <div className="tt-dim" style={{ whiteSpace: 'normal' }}>
        {info.blurb}
      </div>
      {overlay !== 'rivals' ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span>{swatch('rgb(220,70,60)')}low</span>
          <span>{swatch('rgb(220,200,60)')}middling</span>
          <span>{swatch('rgb(70,200,100)')}high</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <span>{swatch(state?.company.color ?? '#fff')}you</span>
          {state?.rivals
            .filter(r => Object.values(state.townShows).some(t => (t[r.id] ?? 0) > 0))
            .slice(0, 6)
            .map(r => (
              <span key={r.id}>
                {swatch(r.color)}
                {r.name}
              </span>
            ))}
        </div>
      )}
      <div className="tt-dim">The layers button (or O) switches views.</div>
    </div>
  );
}
