import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleHelp,
  Crosshair,
  FastForward,
  Home,
  LogOut,
  MapPin,
  Newspaper,
  Pause,
  Play,
  Trophy,
  Truck,
  Wallet,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { companyTier, tierInfo } from '@/world/catalog';
import { formatHour } from '@/world/core';
import { getWorld } from '@/world/mapgen';
import type { NewsItem } from '@/world/types';
import { MapCanvas, type MapHandle, type Pick } from './MapCanvas';
import type { Selection } from './render/renderer';
import { useTycoon } from './useTycoon';
import { Window } from './ui/Window';
import { money } from './ui/format';
import { CityWindow, DepotListWindow, DepotWindow, TownsWindow, VenueWindow } from './ui/places';
import { VehicleListWindow, VehicleWindow } from './ui/fleet';
import { GigWindow, ShowsWindow } from './ui/shows';
import { FinanceWindow, GameOverPanel, HelpWindow, LeagueWindow, NewGameForm, NewsWindow } from './ui/company';
import type { WinCtx, WindowKind } from './ui/types';
import './tycoon.css';

interface OpenWindow {
  key: string;
  kind: WindowKind;
  refId?: string;
  x: number;
  y: number;
  z: number;
}

const MAX_WINDOWS = 6;
const SPEED_LABELS = ['Paused', '▶', '▶▶', '▶▶▶', 'Fast-forward'];

export default function TycoonGame() {
  const game = useTycoon();
  const { state } = game;
  const mapRef = useRef<MapHandle>(null);
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const zCounter = useRef(1);
  const [follow, setFollow] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; ok: boolean }[]>([]);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const showNewGame = !state || game.isPreview;

  const open = useCallback((kind: WindowKind, refId?: string) => {
    setWindows(prev => {
      const key = `${kind}:${refId ?? ''}`;
      const existing = prev.find(w => w.key === key);
      zCounter.current += 1;
      if (existing) return prev.map(w => (w.key === key ? { ...w, z: zCounter.current } : w));
      const n = prev.length;
      const narrow = window.innerWidth < 640;
      const win: OpenWindow = {
        key,
        kind,
        refId,
        x: narrow ? 6 : Math.min(window.innerWidth - 360, 60 + ((n * 28) % 220)),
        y: narrow ? 60 : 56 + ((n * 28) % 200),
        z: zCounter.current,
      };
      const next = [...prev, win];
      return next.length > MAX_WINDOWS ? next.slice(next.length - MAX_WINDOWS) : next;
    });
  }, []);

  const closeWindow = (key: string) => setWindows(prev => prev.filter(w => w.key !== key));
  const focusWindow = (key: string) => {
    zCounter.current += 1;
    setWindows(prev => prev.map(w => (w.key === key ? { ...w, z: zCounter.current } : w)));
  };

  const toast = useCallback((text: string, ok = true) => {
    if (!text) return;
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-2), { id, text, ok }]);
    window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const goTo = useCallback((x: number, y: number) => {
    setFollow(null);
    mapRef.current?.centreOnTile(x, y);
  }, []);

  const onPick = useCallback(
    (pick: Pick | null) => {
      if (!pick) return;
      if (pick.kind === 'gigs') {
        if (pick.gigIds.length === 1) open('gig', pick.gigIds[0]);
        else open('venue', pick.venueId);
      } else if (pick.kind === 'venue') open('venue', pick.id);
      else open(pick.kind, pick.id);
    },
    [open],
  );

  // News popups fade after a while.
  const { popups, dismissPopup } = game;
  useEffect(() => {
    if (!popups.length) return;
    const oldest = popups[0];
    const t = window.setTimeout(() => dismissPopup(oldest.id), 7000);
    return () => window.clearTimeout(t);
  }, [popups, dismissPopup]);

  // Keyboard: space pauses, 1-4 set speed, Esc closes the top window.
  const lastSpeed = useRef(1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (game.speed) {
          lastSpeed.current = game.speed;
          game.setSpeed(0);
        } else game.setSpeed(lastSpeed.current || 1);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        game.setSpeed(Number(e.key));
      } else if (e.key === 'Escape') {
        setWindows(prev => {
          if (!prev.length) return prev;
          const top = prev.reduce((a, b) => (a.z > b.z ? a : b));
          return prev.filter(w => w.key !== top.key);
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  const top = windows.length ? windows.reduce((a, b) => (a.z > b.z ? a : b)) : null;
  const selection: Selection =
    top && top.refId && (top.kind === 'vehicle' || top.kind === 'venue' || top.kind === 'city' || top.kind === 'depot')
      ? { kind: top.kind, id: top.refId }
      : follow
        ? { kind: 'vehicle', id: follow }
        : null;

  const brand = state && !game.isPreview ? state.company.color : '#64748b';
  const world = state ? getWorld(state.mapSeed) : null;

  const titleFor = (w: OpenWindow): string => {
    if (!state || !world) return '';
    switch (w.kind) {
      case 'city':
        return world.cityById.get(w.refId!)?.name ?? 'Town';
      case 'venue':
        return world.venueById.get(w.refId!)?.name ?? 'Venue';
      case 'gig':
        return state.gigs.find(g => g.id === w.refId)?.act ?? 'Show';
      case 'vehicle':
        return state.vehicles.find(v => v.id === w.refId)?.name ?? 'Vehicle';
      case 'depot': {
        const d = state.depots.find(x => x.id === w.refId);
        return `Warehouse — ${d ? world.cityById.get(d.cityId)?.name : ''}`;
      }
      case 'depots':
        return 'Warehouses';
      case 'vehicles':
        return 'Fleet';
      case 'shows':
        return 'Shows';
      case 'finance':
        return `Finances — ${state.company.name}`;
      case 'news':
        return 'News';
      case 'towns':
        return 'Towns';
      case 'league':
        return 'Company league';
      case 'help':
        return 'How to play';
    }
  };

  const renderWindow = (w: OpenWindow, ctx: WinCtx) => {
    switch (w.kind) {
      case 'city':
        return <CityWindow ctx={ctx} cityId={w.refId!} />;
      case 'venue':
        return <VenueWindow ctx={ctx} venueId={w.refId!} />;
      case 'gig':
        return <GigWindow ctx={ctx} gigId={w.refId!} />;
      case 'vehicle':
        return <VehicleWindow ctx={ctx} vehicleId={w.refId!} />;
      case 'vehicles':
        return <VehicleListWindow ctx={ctx} />;
      case 'depot':
        return <DepotWindow ctx={ctx} depotId={w.refId!} />;
      case 'depots':
        return <DepotListWindow ctx={ctx} />;
      case 'shows':
        return <ShowsWindow ctx={ctx} />;
      case 'finance':
        return <FinanceWindow ctx={ctx} />;
      case 'news':
        return <NewsWindow ctx={ctx} />;
      case 'towns':
        return <TownsWindow ctx={ctx} />;
      case 'league':
        return <LeagueWindow ctx={ctx} />;
      case 'help':
        return <HelpWindow />;
    }
  };

  const latest: NewsItem | undefined = state?.news[0];
  const tier = state ? companyTier(state.company.reputation) : 1;
  const hq = state && world ? world.cityById.get(state.company.hqCityId) : undefined;

  return (
    <div className="tt-root" style={{ ['--tt-brand' as string]: brand }}>
      <MapCanvas
        ref={mapRef}
        stateRef={game.stateRef}
        alphaRef={game.alphaRef}
        selection={selection}
        followVehicleId={follow}
        onPick={showNewGame ? () => undefined : onPick}
        onUserPan={() => setFollow(null)}
      />

      {state && !showNewGame && (
        <>
          <div className="tt-toolbar">
            <div className="tt-group">
              <button className="tt-btn" data-on={game.speed === 0} onClick={() => game.setSpeed(0)} title="Pause (space)">
                <Pause />
              </button>
              <button className="tt-btn" data-on={game.speed === 1} onClick={() => game.setSpeed(1)} title="Normal speed (1)">
                <Play />
              </button>
              <button className="tt-btn" data-on={game.speed === 2} onClick={() => game.setSpeed(2)} title="Fast (2)">
                <Play />
                <Play style={{ marginLeft: -12 }} />
              </button>
              <button className="tt-btn" data-on={game.speed === 3} onClick={() => game.setSpeed(3)} title="Faster (3)">
                <FastForward />
              </button>
              <button className="tt-btn" data-on={game.speed === 4} onClick={() => game.setSpeed(4)} title="Fast-forward (4)">
                <FastForward />
                <FastForward style={{ marginLeft: -10 }} />
              </button>
            </div>
            <span className="tt-sep" />
            <div className="tt-group">
              <button className="tt-btn" onClick={() => open('shows')} title="Shows">
                <CalendarDays /> <span className="tt-label">Shows</span>
              </button>
              <button className="tt-btn" onClick={() => open('vehicles')} title="Fleet">
                <Truck /> <span className="tt-label">Fleet</span>
              </button>
              <button className="tt-btn" onClick={() => open('towns')} title="Towns">
                <MapPin /> <span className="tt-label">Towns</span>
              </button>
              <button className="tt-btn" onClick={() => open('depots')} title="Warehouses">
                <Building2 /> <span className="tt-label">Warehouses</span>
              </button>
              <button className="tt-btn" onClick={() => open('finance')} title="Finances">
                <Wallet /> <span className="tt-label">Finances</span>
              </button>
              <button className="tt-btn" onClick={() => open('league')} title="Company league">
                <Trophy />
              </button>
              <button className="tt-btn" onClick={() => open('news')} title="News">
                <Newspaper />
              </button>
            </div>
            <span className="tt-sep" />
            <div className="tt-group">
              <button className="tt-btn" onClick={() => mapRef.current?.zoomBy(1 / 1.25)} title="Zoom out">
                <ZoomOut />
              </button>
              <button className="tt-btn" onClick={() => mapRef.current?.zoomBy(1.25)} title="Zoom in">
                <ZoomIn />
              </button>
              <button className="tt-btn" onClick={() => hq && goTo(hq.x, hq.y)} title="Go to HQ">
                <Home />
              </button>
              {follow && (
                <button className="tt-btn" data-on onClick={() => setFollow(null)} title="Stop following">
                  <Crosshair />
                </button>
              )}
            </div>
            <span className="tt-sep" />
            <div className="tt-group">
              <button className="tt-btn" onClick={() => open('help')} title="How to play">
                <CircleHelp />
              </button>
              <button className="tt-btn" onClick={() => setConfirmQuit(true)} title="New company">
                <LogOut />
              </button>
            </div>
          </div>

          {game.speed !== 1 && (
            <div className="tt-speed-badge tt-bevel" style={{ color: game.speed === 0 ? '#fbbf24' : '#fff' }}>
              {SPEED_LABELS[game.speed]}
            </div>
          )}

          {windows.map(w => {
            const ctx: WinCtx = {
              state,
              dispatch: game.dispatch,
              open,
              close: () => closeWindow(w.key),
              goTo,
              follow: id => {
                setFollow(id);
              },
              followingId: follow,
              toast,
            };
            return (
              <Window
                key={w.key}
                title={titleFor(w)}
                x={w.x}
                y={w.y}
                z={w.z}
                width={w.kind === 'finance' || w.kind === 'league' ? 440 : 340}
                onMove={(x, y) => setWindows(prev => prev.map(o => (o.key === w.key ? { ...o, x, y } : o)))}
                onFocus={() => focusWindow(w.key)}
                onClose={() => closeWindow(w.key)}
              >
                {renderWindow(w, ctx)}
              </Window>
            );
          })}

          <div className="tt-popups">
            {toasts.map(t => (
              <div key={t.id} className={`tt-popup ${t.ok ? 'good' : 'bad'}`} style={{ fontFamily: 'inherit', background: '#e9ecf2' }}>
                <div>{t.text}</div>
              </div>
            ))}
            {game.popups.map(p => (
              <div
                key={p.id}
                className={`tt-popup ${p.tone}`}
                onClick={() => {
                  game.dismissPopup(p.id);
                  if (p.gigId) open('gig', p.gigId);
                  else if (p.vehicleId) open('vehicle', p.vehicleId);
                }}
              >
                <div>
                  <div className="kicker">
                    {p.tone === 'good' ? 'Rave review' : p.tone === 'bad' ? 'Trouble' : 'Industry news'} · {formatHour(state, p.hour)}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 14, lineHeight: 1.3 }}>{p.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="tt-status">
            <div className="tt-inset" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {formatHour(state, state.hour)}
            </div>
            <div className="tt-inset news" onClick={() => open('news')}>
              {latest ? latest.text : ''}
            </div>
            <div className="tt-inset" onClick={() => open('finance')} style={{ cursor: 'pointer' }}>
              <span className="tt-chip" style={{ background: tierInfo(tier).color }}>
                ★ {Math.round(state.company.reputation)}
              </span>
              <span className={`tt-money ${state.company.cash < 0 ? 'neg' : ''}`}>{money(state.company.cash)}</span>
            </div>
          </div>
        </>
      )}

      {showNewGame && (
        <div className="tt-overlay" style={{ background: 'rgba(8,10,14,0.25)', backdropFilter: 'none' }}>
          <Window title="New company" x={0} y={0} z={100} onMove={() => undefined} onFocus={() => undefined}>
            <NewGameForm
              onPreview={game.preview}
              onStart={opts => {
                setWindows([]);
                setFollow(null);
                game.newGame(opts);
                open('help');
              }}
            />
          </Window>
        </div>
      )}

      {state?.gameOver && !game.isPreview && (
        <div className="tt-overlay">
          <Window title="The receivers have arrived" x={0} y={0} z={100} onMove={() => undefined} onFocus={() => undefined}>
            <GameOverPanel
              state={state}
              onRestart={() => {
                setWindows([]);
                game.abandon();
              }}
            />
          </Window>
        </div>
      )}

      {confirmQuit && (
        <div className="tt-overlay">
          <Window title="Start a new company?" x={0} y={0} z={100} onMove={() => undefined} onFocus={() => undefined} onClose={() => setConfirmQuit(false)}>
            <p style={{ marginTop: 0 }}>Your current company will be lost.</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <a className="tt-btn sm" href={`${import.meta.env.BASE_URL}classic`}>
                Open the classic version
              </a>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="tt-btn" onClick={() => setConfirmQuit(false)}>
                  Keep playing
                </button>
                <button
                  className="tt-btn primary"
                  onClick={() => {
                    setConfirmQuit(false);
                    setWindows([]);
                    game.abandon();
                  }}
                >
                  New company
                </button>
              </div>
            </div>
          </Window>
        </div>
      )}
    </div>
  );
}
