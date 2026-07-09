import { getAvatarTraits } from '@/lib/avatarSeed';
import type { Department } from '@/types/game';

interface CrewAvatarProps {
  /** Stable id to seed the face from — crew id or candidate id. */
  id: string;
  department: Department;
  size?: number;
  className?: string;
}

// Matches the department HSL tokens in index.css so the accessory always
// reads as "their department", not an arbitrary color.
const DEPARTMENT_ACCENT: Record<Department, string> = {
  audio: 'hsl(210, 100%, 56%)',
  lighting: 'hsl(45, 93%, 58%)',
  video: 'hsl(280, 65%, 60%)',
  stage: 'hsl(160, 60%, 50%)',
};

/**
 * A small procedural face, deterministic per id (see src/lib/avatarSeed.ts)
 * so the same crew member always looks the same across renders/sessions.
 * Purely cosmetic SVG — no gameplay state lives here.
 */
export function CrewAvatar({ id, department, size = 40, className }: CrewAvatarProps) {
  const traits = getAvatarTraits(id);
  const accent = DEPARTMENT_ACCENT[department];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label={`Avatar for ${department} crew member`}
    >
      <circle cx="20" cy="20" r="19" fill={traits.skinTone} stroke={accent} strokeWidth="2" />

      {/* Ears */}
      <circle cx="4" cy="21" r="3" fill={traits.skinTone} />
      <circle cx="36" cy="21" r="3" fill={traits.skinTone} />

      {/* Eyes */}
      <circle cx="14" cy="19" r="1.6" fill="#2b2b2b" />
      <circle cx="26" cy="19" r="1.6" fill="#2b2b2b" />

      {/* Mouth */}
      <path d="M14 26 Q20 30 26 26" stroke="#7a3d2e" strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {/* Hair */}
      {traits.hairStyle === 'short' && (
        <path d="M3 16 Q20 -2 37 16 L37 12 Q20 -4 3 12 Z" fill={traits.hairColor} />
      )}
      {traits.hairStyle === 'long' && (
        <path
          d="M2 22 Q1 4 20 3 Q39 4 38 22 L34 22 Q35 8 20 7 Q5 8 6 22 Z"
          fill={traits.hairColor}
        />
      )}
      {traits.hairStyle === 'mohawk' && (
        <>
          <path d="M4 14 Q20 2 36 14 L36 10 Q20 0 4 10 Z" fill={traits.skinTone} opacity="0" />
          <rect x="16" y="-2" width="8" height="16" rx="3" fill={traits.hairColor} />
        </>
      )}
      {traits.hairStyle === 'afro' && (
        <circle cx="20" cy="14" r="17" fill={traits.hairColor} />
      )}
      {/* bald: no hair drawn */}

      {/* Re-draw face circle on top when hair might overlap it (afro) */}
      {traits.hairStyle === 'afro' && (
        <circle cx="20" cy="21" r="14" fill={traits.skinTone} />
      )}
      {traits.hairStyle === 'afro' && (
        <>
          <circle cx="14" cy="19" r="1.6" fill="#2b2b2b" />
          <circle cx="26" cy="19" r="1.6" fill="#2b2b2b" />
          <path d="M14 26 Q20 30 26 26" stroke="#7a3d2e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Accessory */}
      {traits.accessory === 'glasses' && (
        <g stroke="#222" strokeWidth="1.4" fill="none">
          <circle cx="14" cy="19" r="4" />
          <circle cx="26" cy="19" r="4" />
          <line x1="18" y1="19" x2="22" y2="19" />
        </g>
      )}
      {traits.accessory === 'beanie' && (
        <path d="M2 15 Q20 -3 38 15 L38 10 Q20 -6 2 10 Z" fill={accent} />
      )}
      {traits.accessory === 'headband' && (
        <rect x="1" y="12" width="38" height="4" fill={accent} />
      )}

      {/* Department accent chip */}
      <circle cx="32" cy="32" r="6.5" fill={accent} stroke="hsl(220 25% 8%)" strokeWidth="1.5" />
    </svg>
  );
}
