import { useRef, type ReactNode } from 'react';

interface Props {
  title: ReactNode;
  x: number;
  y: number;
  z: number;
  width?: number;
  onMove: (x: number, y: number) => void;
  onFocus: () => void;
  onClose?: () => void;
  /** Shown in sheet mode when there's a window underneath to go back to. */
  onBack?: () => void;
  /** Phone layout: docked sheet, no dragging. */
  sheet?: boolean;
  children: ReactNode;
}

/** A draggable, bevelled TT-style window. */
export function Window({ title, x, y, z, width, onMove, onFocus, onClose, onBack, sheet, children }: Props) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    if (sheet || (e.target as HTMLElement).closest('button')) return;
    onFocus();
    drag.current = { dx: e.clientX - x, dy: e.clientY - y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = Math.max(-200, Math.min(window.innerWidth - 80, e.clientX - drag.current.dx));
    const ny = Math.max(38, Math.min(window.innerHeight - 60, e.clientY - drag.current.dy));
    onMove(nx, ny);
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div
      className="tt-window tt-bevel"
      style={{ left: x, top: y, zIndex: 30 + z, width }}
      onPointerDown={onFocus}
    >
      <div className="tt-titlebar" onPointerDown={onDown} onPointerMove={onDrag} onPointerUp={onUp}>
        {onClose && (
          <button className="tt-close" onClick={onClose} aria-label="Close window">
            ✕
          </button>
        )}
        <span className="title">{title}</span>
        {onBack && (
          <button className="tt-back" onClick={onBack} aria-label="Back">
            ‹ Back
          </button>
        )}
      </div>
      <div className="tt-body">{children}</div>
    </div>
  );
}
