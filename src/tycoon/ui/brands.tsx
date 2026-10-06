/**
 * Brand badges and gear sprites.
 *
 * Badges are typographic wordmarks in each brand's colours — evocative, not
 * copies of anyone's logo artwork. For a personal build you can drop the
 * official logos in `public/brands/` and list them in
 * `public/brands/index.json` ({ "l-acoustics": "l-acoustics.svg", ... });
 * any brand or company listed there is shown with its file instead.
 */
import { useEffect, useState } from 'react';
import { getProduct } from '@/world/content/gear';
import { gearSpriteUrl } from './pixel';
import { STYLES, brandAccent, slug, type BrandStyle } from './brandStyles';

// --- Optional official logos (personal builds) -------------------------------
let logoIndex: Record<string, string> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadLogoIndex() {
  if (loading) return loading;
  loading = fetch(`${import.meta.env.BASE_URL}brands/index.json`)
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then(json => {
      logoIndex = json && typeof json === 'object' ? (json as Record<string, string>) : {};
      listeners.forEach(l => l());
    });
  return loading;
}

function useLogo(name: string): string | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump(x => x + 1);
    listeners.add(l);
    void loadLogoIndex();
    return () => {
      listeners.delete(l);
    };
  }, []);
  const file = logoIndex?.[slug(name)];
  return file ? `${import.meta.env.BASE_URL}brands/${file}` : undefined;
}

export function BrandBadge({ brand, color, size = 'sm' }: { brand: string; color?: string; size?: 'sm' | 'md' }) {
  const logo = useLogo(brand);
  const h = size === 'md' ? 22 : 16;
  if (logo) {
    return <img src={logo} alt={brand} title={brand} style={{ height: h, maxWidth: 90, objectFit: 'contain', background: '#fff', padding: 1 }} />;
  }
  const s: BrandStyle = STYLES[brand] ?? { bg: color ?? '#334155', fg: '#fff', text: brand.toUpperCase(), weight: 800 };
  return (
    <span
      title={brand}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: h,
        padding: '0 5px',
        background: s.bg,
        color: s.fg,
        border: s.bg === '#fff' ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
        fontFamily: s.serif ? 'Georgia, "Times New Roman", serif' : 'ui-sans-serif, system-ui, sans-serif',
        fontWeight: s.weight ?? 800,
        fontStyle: s.italic ? 'italic' : 'normal',
        letterSpacing: s.spacing ? `${s.spacing * 0.05}em` : undefined,
        fontSize: size === 'md' ? 12 : 9.5,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {s.text ?? brand}
    </span>
  );
}

export function GearSprite({ productId, size = 40 }: { productId: string; size?: number }) {
  const p = getProduct(productId);
  return (
    <img
      src={gearSpriteUrl(p.kind, brandAccent(p.brand))}
      alt=""
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', flexShrink: 0, background: '#11141a', border: '1px solid #000' }}
    />
  );
}
