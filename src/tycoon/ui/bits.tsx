import type { ReactNode } from 'react';
import { DEPT_COLORS, DEPT_LABELS, tierInfo } from '@/world/catalog';
import type { Dept } from '@/world/types';

export function Bar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1))) * 100;
  return (
    <div className="tt-bar">
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function TierChip({ tier, locked }: { tier: number; locked?: boolean }) {
  const info = tierInfo(tier);
  return (
    <span className="tt-chip" style={{ background: locked ? '#52525b' : info.color, color: locked ? '#d4d4d8' : undefined }}>
      {locked ? '🔒 ' : ''}
      {info.label}
    </span>
  );
}

export function DeptDot({ dept }: { dept: Dept }) {
  return (
    <span
      title={DEPT_LABELS[dept]}
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: DEPT_COLORS[dept], flexShrink: 0 }}
    />
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tt-row">
      <span className="tt-dim">{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{children}</span>
    </div>
  );
}
