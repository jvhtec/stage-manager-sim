import { briefing, type Alert } from '@/world/advisor';
import type { WinCtx } from './types';

const ICON: Record<Alert['tone'], string> = { bad: '🔴', warn: '🟠', info: '🔵' };

/** What needs doing: a short, sorted list with a way into each problem. */
export function BriefingWindow({ ctx }: { ctx: WinCtx }) {
  const alerts = briefing(ctx.state);
  if (!alerts.length) {
    return <div className="tt-dim">All quiet. Nothing is about to go wrong that I can see.</div>;
  }
  return (
    <div className="tt-list">
      {alerts.map(a => (
        <div key={a.id} className={`tt-item${a.go ? ' clickable' : ''}`} onClick={() => a.go && ctx.open(a.go.kind, a.go.refId)} style={{ gap: 8 }}>
          <span>{ICON[a.tone]}</span>
          <div className="grow" style={{ whiteSpace: 'normal' }}>
            {a.text}
          </div>
          {a.go && <span className="tt-dim">›</span>}
        </div>
      ))}
      <div className="tt-dim" style={{ marginTop: 4, whiteSpace: 'normal' }}>
        Red needs you now, orange soon, blue is worth a look. Tap one to go straight to it.
      </div>
    </div>
  );
}
