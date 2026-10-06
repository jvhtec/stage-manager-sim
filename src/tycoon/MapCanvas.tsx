import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { getWorld } from '@/world/mapgen';
import { getCityPath, positionOnPath } from '@/world/pathfinding';
import type { TycoonState } from '@/world/types';
import { centreOn, pickTile, type Camera } from './render/iso';
import { renderWorld, type HitTargets, type Selection } from './render/renderer';

export type Pick =
  | { kind: 'vehicle'; id: string }
  | { kind: 'venue'; id: string; cityId: string }
  | { kind: 'gigs'; gigIds: string[]; venueId: string }
  | { kind: 'city'; id: string }
  | { kind: 'depot'; id: string };

export interface MapHandle {
  centreOnTile: (x: number, y: number) => void;
  zoomBy: (factor: number) => void;
}

interface Props {
  stateRef: React.MutableRefObject<TycoonState | null>;
  alphaRef: React.MutableRefObject<number>;
  selection: Selection;
  followVehicleId: string | null;
  onPick: (pick: Pick | null) => void;
  onUserPan: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(
  { stateRef, alphaRef, selection, followVehicleId, onPick, onUserPan },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 2, w: 800, h: 600 });
  const hitsRef = useRef<HitTargets>({ vehicles: [], markers: [], labels: [] });
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const centredOn = useRef<string | null>(null);
  const propsRef = useRef({ selection, followVehicleId, onPick, onUserPan });
  propsRef.current = { selection, followVehicleId, onPick, onUserPan };

  useImperativeHandle(ref, () => ({
    centreOnTile: (x, y) => {
      const s = stateRef.current;
      if (!s) return;
      camRef.current = centreOn(camRef.current, getWorld(s.mapSeed), x + 0.5, y + 0.5);
    },
    zoomBy: factor => {
      const cam = camRef.current;
      cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
    },
  }));

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const draw = (time: number) => {
      const s = stateRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = camRef.current;
      cam.w = w;
      cam.h = h;
      if (s) {
        const map = getWorld(s.mapSeed);
        const key = `${s.mapSeed}:${s.company.hqCityId}`;
        if (centredOn.current !== key) {
          centredOn.current = key;
          const hq = map.cityById.get(s.company.hqCityId);
          if (hq) camRef.current = centreOn(cam, map, hq.x + 0.5, hq.y + 0.5);
        }
        const follow = propsRef.current.followVehicleId;
        if (follow) {
          const v = s.vehicles.find(x => x.id === follow);
          if (v) {
            let tx: number;
            let ty: number;
            if (v.route) {
              const pos = positionOnPath(map, getCityPath(map, v.route.from, v.route.to), v.route.progress);
              tx = pos.x;
              ty = pos.y;
            } else {
              const c = map.cityById.get(v.cityId ?? v.homeCityId)!;
              tx = c.x + 0.5;
              ty = c.y + 0.5;
            }
            const target = centreOn(camRef.current, map, tx, ty);
            camRef.current.x += (target.x - camRef.current.x) * 0.12;
            camRef.current.y += (target.y - camRef.current.y) * 0.12;
          }
        }
        hitsRef.current = renderWorld(ctx, {
          map,
          state: s,
          cam: camRef.current,
          time,
          alpha: alphaRef.current,
          hover: hoverRef.current,
          selection: propsRef.current.selection,
        });
      } else {
        ctx.fillStyle = '#10131a';
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stateRef, alphaRef]);

  // Input: drag to pan, pinch / wheel to zoom, click to pick.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let dragDist = 0;
    let pinchStart: { dist: number; zoom: number } | null = null;

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const zoomAt = (factor: number, px: number, py: number) => {
      const cam = camRef.current;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
      // Keep the point under the cursor fixed.
      const bx = (px - cam.w / 2) / cam.zoom + cam.x;
      const by = (py - cam.h / 2) / cam.zoom + cam.y;
      cam.zoom = next;
      cam.x = bx - (px - cam.w / 2) / next;
      cam.y = by - (py - cam.h / 2) / next;
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      dragDist = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: camRef.current.zoom };
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const s = stateRef.current;
      if (s && e.pointerType === 'mouse') hoverRef.current = pickTile(camRef.current, getWorld(s.mapSeed), p.x, p.y);
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, p);
      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const target = pinchStart.zoom * (dist / pinchStart.dist);
        zoomAt(target / camRef.current.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
        dragDist += 10;
        return;
      }
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      dragDist += Math.abs(dx) + Math.abs(dy);
      if (dragDist > 5) {
        camRef.current.x -= dx / camRef.current.zoom;
        camRef.current.y -= dy / camRef.current.zoom;
        propsRef.current.onUserPan();
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasClick = pointers.size === 1 && dragDist <= 5;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (wasClick) propsRef.current.onPick(pick(local(e)));
    };
    const onLeave = () => {
      hoverRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    };

    const pick = ({ x, y }: { x: number; y: number }): Pick | null => {
      const s = stateRef.current;
      if (!s) return null;
      const hits = hitsRef.current;
      const inRect = (r: { x: number; y: number; w: number; h: number }) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      const marker = [...hits.markers].reverse().find(inRect);
      if (marker) return { kind: 'gigs', gigIds: marker.gigIds, venueId: marker.venueId };
      const label = hits.labels.find(inRect);
      if (label) return { kind: 'city', id: label.cityId };
      const radius = Math.max(10, 9 * camRef.current.zoom);
      let best: { id: string; d: number } | null = null;
      hits.vehicles.forEach(v => {
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < radius && (!best || d < best.d)) best = { id: v.id, d };
      });
      if (best) return { kind: 'vehicle', id: (best as { id: string }).id };

      const map = getWorld(s.mapSeed);
      const tile = pickTile(camRef.current, map, x, y);
      if (!tile) return null;
      for (const city of map.cities) {
        const venue = city.venues.find(v => tile.x >= v.x && tile.x < v.x + v.w && tile.y >= v.y && tile.y < v.y + v.h);
        if (venue) return { kind: 'venue', id: venue.id, cityId: city.id };
        const depot = s.depots.find(d => d.cityId === city.id);
        const site = depot ? city.lots[depot.lot] : undefined;
        if (depot && site && tile.x >= site.x && tile.x < site.x + 2 && tile.y >= site.y && tile.y < site.y + 2) {
          return { kind: 'depot', id: depot.id };
        }
        if (Math.hypot(tile.x - city.x, tile.y - city.y) <= city.radius + 1) return { kind: 'city', id: city.id };
      }
      return null;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [stateRef]);

  // Keyboard panning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const step = 60 / camRef.current.zoom;
      const cam = camRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a') cam.x -= step;
      else if (e.key === 'ArrowRight' || e.key === 'd') cam.x += step;
      else if (e.key === 'ArrowUp' || e.key === 'w') cam.y -= step;
      else if (e.key === 'ArrowDown' || e.key === 's') cam.y += step;
      else if (e.key === '+' || e.key === '=') cam.zoom = Math.min(MAX_ZOOM, cam.zoom * 1.2);
      else if (e.key === '-') cam.zoom = Math.max(MIN_ZOOM, cam.zoom / 1.2);
      else return;
      propsRef.current.onUserPan();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <canvas ref={canvasRef} className="tt-map" />;
});
