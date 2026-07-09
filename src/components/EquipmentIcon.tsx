import type { EquipmentType } from '@/types/game';

interface EquipmentIconProps {
  type: EquipmentType;
  className?: string;
  size?: number;
}

/**
 * Small SVG glyphs per equipment type, replacing generic lucide icons with
 * something that actually reads as "PA stack" / "LED wall" / etc. at a
 * glance. Purely decorative — no state, no seeding needed (every PA system
 * looks like a PA system).
 */
export function EquipmentIcon({ type, className, size = 20 }: EquipmentIconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', className };

  switch (type) {
    case 'pa-system':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="2" width="14" height="20" rx="1.5" />
          <circle cx="12" cy="7" r="2.4" />
          <circle cx="12" cy="15" r="3.2" />
          <circle cx="12" cy="15" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'monitor-rig':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 18 L12 6 L21 18 Z" />
          <circle cx="12" cy="14.5" r="2" />
        </svg>
      );
    case 'lighting-rig':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="4" x2="22" y2="4" />
          <path d="M6 4 L4 9 L8 9 Z" fill="currentColor" stroke="none" />
          <path d="M12 4 L10 9 L14 9 Z" fill="currentColor" stroke="none" />
          <path d="M18 4 L16 9 L20 9 Z" fill="currentColor" stroke="none" />
          <line x1="6" y1="9" x2="4" y2="20" strokeDasharray="1.5 1.5" />
          <line x1="12" y1="9" x2="12" y2="20" strokeDasharray="1.5 1.5" />
          <line x1="18" y1="9" x2="20" y2="20" strokeDasharray="1.5 1.5" />
        </svg>
      );
    case 'led-wall':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="14" rx="1" />
          <line x1="9" y1="4" x2="9" y2="18" />
          <line x1="15" y1="4" x2="15" y2="18" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" />
          <line x1="3" y1="14" x2="21" y2="14" />
        </svg>
      );
    case 'stage-deck':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="14" width="20" height="6" rx="1" />
          <line x1="6" y1="14" x2="6" y2="20" />
          <line x1="12" y1="14" x2="12" y2="20" />
          <line x1="18" y1="14" x2="18" y2="20" />
          <line x1="2" y1="9" x2="22" y2="9" />
        </svg>
      );
    case 'power-dist':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M13 7 L9 13 L12 13 L11 18 L15 11 L12 11 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
  }
}
