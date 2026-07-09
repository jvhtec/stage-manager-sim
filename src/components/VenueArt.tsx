interface VenueArtProps {
  /** Reputation tier level (1-4), matching src/lib/reputationTiers.ts. */
  tier: number;
  className?: string;
}

interface TierScene {
  sky: [string, string];
  stageColor: string;
  crowdRows: number;
  crowdPerRow: number;
  beams: number;
  hasLedWall: boolean;
  hasPyro: boolean;
}

const TIER_SCENES: Record<number, TierScene> = {
  1: {
    sky: ['#2b2320', '#1a1512'],
    stageColor: '#4a3b2f',
    crowdRows: 1,
    crowdPerRow: 7,
    beams: 1,
    hasLedWall: false,
    hasPyro: false,
  },
  2: {
    sky: ['#241a3d', '#150f26'],
    stageColor: '#3a2d55',
    crowdRows: 2,
    crowdPerRow: 10,
    beams: 2,
    hasLedWall: false,
    hasPyro: false,
  },
  3: {
    sky: ['#1d2b4a', '#0f1830'],
    stageColor: '#2d4468',
    crowdRows: 3,
    crowdPerRow: 14,
    beams: 3,
    hasLedWall: true,
    hasPyro: false,
  },
  4: {
    sky: ['#3a1440', '#160a22'],
    stageColor: '#5a2166',
    crowdRows: 4,
    crowdPerRow: 18,
    beams: 4,
    hasLedWall: true,
    hasPyro: true,
  },
};

function crowdDots(scene: TierScene) {
  const dots: { cx: number; cy: number; r: number }[] = [];
  for (let row = 0; row < scene.crowdRows; row++) {
    const y = 82 + row * 5;
    const count = scene.crowdPerRow;
    for (let i = 0; i < count; i++) {
      const x = 10 + (i / (count - 1 || 1)) * 180;
      dots.push({ cx: x, cy: y, r: 2.4 });
    }
  }
  return dots;
}

/**
 * A tier-appropriate stage illustration — dive bar through stadium — reused
 * as an EventCard/EventDetail header banner. Purely presentational; the
 * tier itself is decided elsewhere (Event.venueTier) and never derived here.
 */
export function VenueArt({ tier, className }: VenueArtProps) {
  const scene = TIER_SCENES[Math.min(4, Math.max(1, tier))];
  const gradientId = `venue-sky-${tier}`;
  const beamPositions = Array.from({ length: scene.beams }, (_, i) => {
    const spread = 160 / (scene.beams + 1);
    return 20 + spread * (i + 1);
  });

  return (
    <svg viewBox="0 0 200 100" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="100" fill={`url(#${gradientId})`} />

      {/* Light beams */}
      {beamPositions.map((x, i) => (
        <polygon
          key={i}
          points={`${x - 1},8 ${x + 1},8 ${x + 18},70 ${x - 18},70`}
          fill="white"
          opacity="0.06"
        />
      ))}

      {/* Truss */}
      <rect x="10" y="10" width="180" height="2.5" fill="#111" opacity="0.6" />

      {/* Stage */}
      <rect x="30" y="70" width="140" height="10" fill={scene.stageColor} rx="1" />

      {/* LED wall (tier 3+) */}
      {scene.hasLedWall && (
        <rect x="70" y="42" width="60" height="26" fill="#0b1220" stroke="#3ecbff" strokeWidth="0.6" opacity="0.85" />
      )}
      {scene.hasLedWall && (
        <g opacity="0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={72 + i * 9.6} y={44} width={8} height={22} fill="#3ecbff" opacity={0.15 + (i % 3) * 0.1} />
          ))}
        </g>
      )}

      {/* Pyro bursts (tier 4) */}
      {scene.hasPyro && (
        <g fill="#ffcf5c">
          <circle cx="40" cy="24" r="1.6" />
          <circle cx="46" cy="18" r="1.2" />
          <circle cx="35" cy="30" r="1" />
          <circle cx="160" cy="20" r="1.6" />
          <circle cx="154" cy="28" r="1.1" />
          <circle cx="166" cy="14" r="1" />
        </g>
      )}

      {/* Crowd */}
      <g fill="#0c0c14">
        {crowdDots(scene).map((dot, i) => (
          <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </g>
    </svg>
  );
}
