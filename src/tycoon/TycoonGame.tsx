import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleHelp,
  Crosshair,
  Download,
  Ellipsis,
  FastForward,
  FlaskConical,
  Headphones,
  Home,
  LogOut,
  MapPin,
  Newspaper,
  Pause,
  SlidersHorizontal,
  Play,
  TrendingUp,
  Trophy,
  Truck,
  Users,
  AlertTriangle,
  Gavel,
  Globe,
  Route,
  Wallet,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { companyTier, tierInfo } from '@/world/catalog';
import { formatDay, formatHour } from '@/world/core';
import { worldOf } from '@/world/mapgen';
import type { NewsItem } from '@/world/types';
import { MapCanvas, type MapHandle, type Pick } from './MapCanvas';
import type { Selection } from './render/renderer';
import { useTycoon, SPEEDS } from './useTycoon';
import { useInstallPrompt, useLayout } from './useLayout';
import { Window } from './ui/Window';
import { money, setCurrency } from './ui/format';
import { getCountry } from '@/world/content/countries';
import { CityWindow, DepotListWindow, DepotWindow, TownsWindow, VenueWindow } from './ui/places';
import { VehicleListWindow, VehicleWindow } from './ui/fleet';
import { GigWindow, ShowsWindow } from './ui/shows';
import { TourWindow } from './ui/tours';
import { PoliciesWindow } from './ui/policies';
import { DecisionsWindow } from './ui/decisions';
// Windows you open now and then load on demand, keeping the main game chunk lean.
const TalentWindow = lazy(() => import('./ui/talent').then(m => ({ default: m.TalentWindow })));
const MarketWindow = lazy(() => import('./ui/market').then(m => ({ default: m.MarketWindow })));
const AuctionsWindow = lazy(() => import('./ui/auctions').then(m => ({ default: m.AuctionsWindow })));
const WorldMapWindow = lazy(() => import('./ui/worldMap').then(m => ({ default: m.WorldMapWindow })));
const PlannerWindow = lazy(() => import('./ui/planner').then(m => ({ default: m.PlannerWindow })));
const RndWindow = lazy(() => import('./ui/rnd').then(m => ({ default: m.RndWindow })));
import { CrewWindow } from './ui/crewWindow';
import { Splash } from './ui/Splash';
import { Intro, introSkipped } from './ui/Intro';
import { DEFAULT_COUNTRY } from '@/world/content/countries';
import { createRandomSeed } from '@/lib/rng';
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

  // Front door → (new-company form → intro) → the game.
  const [stage, setStage] = useState<'splash' | 'newgame' | 'intro' | 'play'>('splash');
  const [splashHelp, setSplashHelp] = useState(false);
  const showSplash = stage === 'splash';
  const showNewGame = stage === 'newgame';
  const inGame = stage === 'play';
  const { compact, landscape } = useLayout();
  const installer = useInstallPrompt();

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

  /** Tab-bar navigation on phones: start a fresh stack (tapping the open tab closes it). */
  const openRoot = (kind: WindowKind) => {
    if (windows.length && windows[0].kind === kind) {
      setWindows([]);
      return;
    }
    setWindows([]);
    open(kind);
  };

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

  const goTo = useCallback(
    (x: number, y: number) => {
      setFollow(null);
      // On phones a sheet covers part of the map — aim for the visible part.
      const offset = !compact
        ? undefined
        : landscape
          ? { x: Math.min(420, window.innerWidth * 0.58) / 2, y: 0 }
          : { x: 0, y: window.innerHeight * 0.3 };
      mapRef.current?.centreOnTile(x, y, offset);
    },
    [compact, landscape],
  );

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

  // A new problem needs your call: open it (the clock stops by itself).
  const seenDilemmas = useRef<Set<string>>(new Set());
  const dilemmaIds = state?.dilemmas.map(d => d.id).join(',') ?? '';
  useEffect(() => {
    if (!state || game.isPreview || !inGame) return;
    const fresh = state.dilemmas.filter(d => !seenDilemmas.current.has(d.id));
    fresh.forEach(d => seenDilemmas.current.add(d.id));
    if (fresh.length) open('decisions');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dilemmaIds, inGame]);

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
  const saved = state && !game.isPreview ? state : null;

  // The clock only runs in the game itself; the front door and the intro are quiet.
  useEffect(() => {
    if (stage !== 'play') game.setSpeed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // No save yet: show a map behind the title card.
  useEffect(() => {
    if (stage === 'splash' && !game.state) game.preview(createRandomSeed(), undefined, DEFAULT_COUNTRY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, game.state]);
  setCurrency(getCountry(state?.country).currency);
  const world = state ? worldOf(state) : null;

  const titleFor = (w: OpenWindow): string => {
    if (!state || !world) return '';
    switch (w.kind) {
      case 'city':
        return world.cityById.get(w.refId!)?.name ?? 'Town';
      case 'venue':
        return world.venueById.get(w.refId!)?.name ?? 'Venue';
      case 'gig':
        return state.gigs.find(g => g.id === w.refId)?.act ?? 'Show';
      case 'tour':
        return state.tours.find(t => t.id === w.refId)?.name ?? 'Tour';
      case 'vehicle':
        return state.vehicles.find(v => v.id === w.refId)?.name ?? 'Vehicle';
      case 'depot': {
        const d = state.depots.find(x => x.id === w.refId);
        return `${d?.kind === 'delegation' ? 'Delegation' : 'Warehouse'} — ${d ? world.cityById.get(d.cityId)?.name : ''}`;
      }
      case 'depots':
        return 'Bases';
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
      case 'talent':
        return 'Star techs';
      case 'market':
        return 'Market';
      case 'policies':
        return 'Company policies';
      case 'rnd':
        return 'R&D';
      case 'crew':
        return 'Crew';
      case 'decisions':
        return 'Needs your call';
      case 'auctions':
        return 'Auctions';
      case 'worldmap':
        return 'World tour map';
      case 'planner':
        return 'Plan a run';
      case 'help':
        return 'How to play';
      case 'menu':
        return state.company.name;
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
      case 'tour':
        return <TourWindow ctx={ctx} tourId={w.refId!} />;
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
      case 'talent':
        return <TalentWindow ctx={ctx} />;
      case 'market':
        return <MarketWindow ctx={ctx} />;
      case 'policies':
        return <PoliciesWindow ctx={ctx} />;
      case 'rnd':
        return <RndWindow ctx={ctx} />;
      case 'crew':
        return <CrewWindow ctx={ctx} />;
      case 'decisions':
        return <DecisionsWindow ctx={ctx} />;
      case 'auctions':
        return <AuctionsWindow ctx={ctx} />;
      case 'worldmap':
        return <WorldMapWindow ctx={ctx} tourId={w.refId} />;
      case 'planner':
        return <PlannerWindow ctx={ctx} vehicleId={w.refId} />;
      case 'help':
        return <HelpWindow />;
      case 'menu':
        return (
          <div className="tt-menu">
            {state.dilemmas.length > 0 && (
              <button className="tt-btn" onClick={() => open('decisions')} style={{ color: '#fbbf24' }}>
                <AlertTriangle /> Needs your call ({state.dilemmas.length})
              </button>
            )}
            <button className="tt-btn" onClick={() => open('crew')}>
              <Users /> Crew
            </button>
            <button className="tt-btn" onClick={() => open('market')}>
              <TrendingUp /> Market
            </button>
            <button className="tt-btn" onClick={() => open('planner')}>
              <Route /> Plan a run
            </button>
            <button className="tt-btn" onClick={() => open('worldmap')}>
              <Globe /> World tour map
            </button>
            <button className="tt-btn" onClick={() => open('auctions')}>
              <Gavel /> Auctions{state.auctions.length > 0 ? ` (${state.auctions.length})` : ''}
            </button>
            <button className="tt-btn" onClick={() => open('policies')}>
              <SlidersHorizontal /> Policies
            </button>
            <button className="tt-btn" onClick={() => open('rnd')}>
              <FlaskConical /> R&D
            </button>
            <button className="tt-btn" onClick={() => open('talent')}>
              <Headphones /> Star techs
            </button>
            <button className="tt-btn" onClick={() => open('league')}>
              <Trophy /> League
            </button>
            <button className="tt-btn" onClick={() => open('news')}>
              <Newspaper /> News
            </button>
            <button className="tt-btn" onClick={() => open('help')}>
              <CircleHelp /> How to play
            </button>
            <button className="tt-btn" onClick={() => hq && goTo(hq.x, hq.y)}>
              <Home /> Go to HQ
            </button>
            {installer.canPrompt && (
              <button className="tt-btn primary" onClick={() => installer.install()}>
                <Download /> Install app
              </button>
            )}
            <button className="tt-btn" onClick={() => setConfirmQuit(true)}>
              <LogOut /> New company
            </button>
            {!installer.standalone && installer.isIos && (
              <div className="tt-dim" style={{ gridColumn: '1 / -1', whiteSpace: 'normal' }}>
                Install on iPhone/iPad: tap <b>Share</b> → <b>Add to Home Screen</b>.
              </div>
            )}
          </div>
        );
    }
  };

  const latest: NewsItem | undefined = state?.news[0];
  const tier = state ? companyTier(state.company.reputation) : 1;
  const hq = state && world ? world.cityById.get(state.company.hqCityId) : undefined;

  return (
    <div
      className={['tt-root', compact && 'compact', compact && landscape && 'landscape', !windows.length && 'no-sheet'].filter(Boolean).join(' ')}
      style={{ ['--tt-brand' as string]: brand }}
    >
      <MapCanvas
        ref={mapRef}
        stateRef={game.stateRef}
        alphaRef={game.alphaRef}
        selection={selection}
        followVehicleId={follow}
        onPick={inGame ? onPick : () => undefined}
        onUserPan={() => setFollow(null)}
      />

      {state && inGame && (
        <>
          {compact ? (
            <>
              <div className="tt-hud">
                <button
                  className="tt-btn"
                  data-on={game.speed === 0}
                  onClick={() => game.setSpeed(game.speed ? 0 : lastSpeed.current || 1)}
                  aria-label={game.speed ? 'Pause' : 'Play'}
                >
                  {game.speed ? <Pause /> : <Play />}
                </button>
                <button
                  className="tt-btn"
                  style={{ minWidth: 46 }}
                  onClick={() => {
                    const next = game.speed >= 4 || game.speed === 0 ? 1 : game.speed + 1;
                    lastSpeed.current = next;
                    game.setSpeed(next);
                  }}
                  aria-label="Change speed"
                >
                  {game.speed === 0 ? '||' : game.speed === 4 ? 'FF' : `${SPEEDS[game.speed]}×`}
                </button>
                <div className="date">
                  {formatDay(state, Math.floor(state.hour / 24))}
                  <small>{String(state.hour % 24).padStart(2, '0')}:00</small>
                </div>
                <span className="spacer" />
                <span className="tt-chip" style={{ background: tierInfo(tier).color }} onClick={() => open('league')}>
                  ★ {Math.round(state.company.reputation)}
                </span>
                <span className={`cash ${state.company.cash < 0 ? 'neg' : ''}`} onClick={() => openRoot('finance')}>
                  {money(state.company.cash)}
                </span>
              </div>

              <div className="tt-mapctl">
                {follow && (
                  <button className="tt-btn" data-on onClick={() => setFollow(null)} aria-label="Stop following">
                    <Crosshair />
                  </button>
                )}
                <button className="tt-btn" onClick={() => mapRef.current?.zoomBy(1.25)} aria-label="Zoom in">
                  <ZoomIn />
                </button>
                <button className="tt-btn" onClick={() => mapRef.current?.zoomBy(1 / 1.25)} aria-label="Zoom out">
                  <ZoomOut />
                </button>
                <button className="tt-btn" onClick={() => hq && goTo(hq.x, hq.y)} aria-label="Go to HQ">
                  <Home />
                </button>
              </div>

              <nav className="tt-tabbar">
                {(
                  [
                    ['shows', 'Shows', CalendarDays],
                    ['vehicles', 'Fleet', Truck],
                    ['towns', 'Towns', MapPin],
                    ['depots', 'Bases', Building2],
                    ['finance', 'Money', Wallet],
                    ['menu', 'More', Ellipsis],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <button key={kind} className="tt-tab" data-on={windows[0]?.kind === kind} onClick={() => openRoot(kind)}>
                    <Icon />
                    {label}
                  </button>
                ))}
              </nav>
            </>
          ) : (
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
              {state.dilemmas.length > 0 && (
                <button className="tt-btn" data-on onClick={() => open('decisions')} title="Needs your call" style={{ color: '#fbbf24' }}>
                  <AlertTriangle /> {state.dilemmas.length}
                </button>
              )}
              <button className="tt-btn" onClick={() => open('crew')} title="Crew">
                <Users />
              </button>
              <button className="tt-btn" onClick={() => open('market')} title="Market">
                <TrendingUp />
              </button>
              <button className="tt-btn" onClick={() => open('planner')} title="Plan a run">
                <Route />
              </button>
              <button className="tt-btn" onClick={() => open('worldmap')} title="World tour map">
                <Globe />
              </button>
              <button className="tt-btn" onClick={() => open('auctions')} title="Auctions" data-on={state.auctions.length > 0 ? true : undefined}>
                <Gavel />
                {state.auctions.length > 0 && ` ${state.auctions.length}`}
              </button>
              <button className="tt-btn" onClick={() => open('policies')} title="Company policies">
                <SlidersHorizontal />
              </button>
              <button className="tt-btn" onClick={() => open('rnd')} title="R&D">
                <FlaskConical />
              </button>
              <button className="tt-btn" onClick={() => open('talent')} title="Star techs">
                <Headphones />
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
              {installer.canPrompt && (
                <button className="tt-btn" onClick={() => installer.install()} title="Install as an app">
                  <Download />
                </button>
              )}
              <button className="tt-btn" onClick={() => setConfirmQuit(true)} title="New company">
                <LogOut />
              </button>
            </div>
          </div>
          )}

          {!compact && game.speed !== 1 && (
            <div className="tt-speed-badge tt-bevel" style={{ color: game.speed === 0 ? '#fbbf24' : '#fff' }}>
              {SPEED_LABELS[game.speed]}
            </div>
          )}

          {(compact ? windows.filter(w => w === top) : windows).map(w => {
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
                width={w.kind === 'finance' || w.kind === 'league' || w.kind === 'market' || w.kind === 'crew' || w.kind === 'decisions' || w.kind === 'vehicles' ? 440 : w.kind === 'worldmap' ? 560 : w.kind === 'planner' ? 440 : 340}
                onMove={(x, y) => setWindows(prev => prev.map(o => (o.key === w.key ? { ...o, x, y } : o)))}
                onFocus={() => focusWindow(w.key)}
                onClose={() => (compact ? setWindows([]) : closeWindow(w.key))}
                onBack={compact && windows.length > 1 ? () => closeWindow(w.key) : undefined}
                sheet={compact}
              >
                <Suspense fallback={<div className="tt-dim">Loading…</div>}>{renderWindow(w, ctx)}</Suspense>
              </Window>
            );
          })}

          <div className="tt-popups">
            {(compact ? toasts.slice(-1) : toasts).map(t => (
              <div key={t.id} className={`tt-popup ${t.ok ? 'good' : 'bad'}`} style={{ fontFamily: 'inherit', background: '#e9ecf2' }}>
                <div>{t.text}</div>
              </div>
            ))}
            {(compact ? (toasts.length ? [] : game.popups.slice(-1)) : game.popups).map(p => (
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

          {!compact && (
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
          )}
        </>
      )}

      {showNewGame && (
        <div className="tt-overlay" style={{ background: 'rgba(8,10,14,0.25)', backdropFilter: 'none' }}>
          <Window title="New company" x={0} y={0} z={100} onMove={() => undefined} onFocus={() => undefined}>
            <NewGameForm
              onPreview={game.preview}
              onCancel={() => {
                game.reload();
                setStage('splash');
              }}
              onStart={opts => {
                setWindows([]);
                setFollow(null);
                game.newGame(opts);
                game.setSpeed(0);
                if (introSkipped()) {
                  setStage('play');
                  game.setSpeed(1);
                  open('help');
                } else setStage('intro');
              }}
            />
          </Window>
        </div>
      )}

      {showSplash && (
        <Splash
          saved={saved}
          color={saved?.company.color ?? '#e11d48'}
          onContinue={() => {
            setStage('play');
            game.setSpeed(1);
          }}
          onNew={() => setStage('newgame')}
          onHelp={() => setSplashHelp(true)}
        />
      )}

      {showSplash && splashHelp && (
        <div className="tt-overlay" style={{ zIndex: 320 }}>
          <Window title="How to play" x={0} y={0} z={100} onMove={() => undefined} onFocus={() => undefined} onClose={() => setSplashHelp(false)}>
            <HelpWindow />
          </Window>
        </div>
      )}

      {stage === 'intro' && state && !game.isPreview && (
        <Intro
          state={state}
          onDone={() => {
            setStage('play');
            game.setSpeed(1);
            open('help');
          }}
        />
      )}

      {state?.gameOver && inGame && (
        <div className="tt-overlay">
          <Window title="The receivers have arrived" x={0} y={0} z={100} onMove={() => undefined} onFocus={() => undefined}>
            <GameOverPanel
              state={state}
              onRestart={() => {
                setWindows([]);
                game.abandon();
                setStage('newgame');
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
                    setStage('newgame');
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
