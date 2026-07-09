import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useCountUp } from '@/hooks/useCountUp';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getTierProgress } from '@/lib/reputationTiers';
import { CompanyOnboardingDialog } from '@/components/CompanyOnboardingDialog';
import { GameOverDialog } from '@/components/GameOverDialog';
import { DaySummaryOverlay } from './DaySummaryOverlay';
import { FloatingDelta, type DeltaEvent } from './FloatingDelta';
import { LayoutDashboard, CalendarDays, Users, Package, Wallet, Play, RotateCcw, Star } from 'lucide-react';

/** How long a flash/pop stays visible before settling back to neutral. */
const FLASH_DURATION_MS = 900;

const NAV_ITEMS = [
  { to: '/', label: 'HQ', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/crew', label: 'Crew', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/finances', label: 'Finances', icon: Wallet },
];

function ReputationStars({ reputation }: { reputation: number }) {
  // 5 stars across 0-100 reputation — each star is worth 20 points, and the
  // active star fills proportionally rather than snapping, so movement
  // within a star's band is still visible.
  return (
    <div className="flex items-center gap-0.5" title={`${reputation}% reputation`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const starFloor = i * 20;
        const fill = Math.max(0, Math.min(1, (reputation - starFloor) / 20));
        return (
          <span key={i} className="relative inline-block h-4 w-4">
            <Star className="absolute inset-0 h-4 w-4 text-muted-foreground/30" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className="h-4 w-4 fill-accent text-accent" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

interface GameShellProps {
  children: ReactNode;
}

export function GameShell({ children }: GameShellProps) {
  const {
    gameState,
    advanceDay,
    completeCompanyOnboarding,
    resetGame,
    daySummary,
    dismissDaySummary,
  } = useGame();
  const navigate = useNavigate();
  const tierProgress = getTierProgress(gameState.company.reputation);
  const animatedBalance = useCountUp(gameState.company.balance);

  const [balanceDeltas, setBalanceDeltas] = useState<DeltaEvent[]>([]);
  const [flashSign, setFlashSign] = useState<'positive' | 'negative' | null>(null);
  const prevBalanceRef = useRef(gameState.company.balance);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    const delta = gameState.company.balance - prev;
    prevBalanceRef.current = gameState.company.balance;
    if (delta === 0) return;

    const id = `delta-${Date.now()}-${Math.random()}`;
    setBalanceDeltas(current => [...current, { id, amount: delta }]);
    setFlashSign(delta > 0 ? 'positive' : 'negative');

    const removeTimer = setTimeout(() => {
      setBalanceDeltas(current => current.filter(d => d.id !== id));
    }, 1300);
    const flashTimer = setTimeout(() => setFlashSign(null), FLASH_DURATION_MS);

    return () => {
      clearTimeout(removeTimer);
      clearTimeout(flashTimer);
    };
  }, [gameState.company.balance]);

  const onboardingInitialValues = {
    name: gameState.company.name,
    brandColor: gameState.company.brandColor,
    accentColor: gameState.company.accentColor,
    specialization: gameState.company.specialization,
    tagline: gameState.company.tagline,
  };

  const marketHighlights = [...gameState.marketNews]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6);
  const tickerText = marketHighlights.length > 0
    ? marketHighlights.map(item => item.title).join('   •   ')
    : 'No market activity yet — advance a day to see the field move.';

  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <CompanyOnboardingDialog
        open={!gameState.hasCompletedOnboarding}
        initialValues={onboardingInitialValues}
        onComplete={completeCompanyOnboarding}
        disableClose={!gameState.hasCompletedOnboarding}
      />
      <GameOverDialog
        open={gameState.isGameOver}
        companyName={gameState.company.name}
        runSummary={gameState.runSummary}
        onStartNewCompany={resetGame}
      />
      {daySummary && <DaySummaryOverlay summary={daySummary} onContinue={dismissDaySummary} />}

      {/* Top HUD bar */}
      <header
        className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{ borderTopColor: gameState.company.brandColor, borderTopWidth: 3 }}
      >
        <button
          className="flex items-center gap-2 font-semibold"
          style={{ color: gameState.company.brandColor }}
          onClick={() => navigate('/')}
        >
          {gameState.company.name}
        </button>

        <div className="hidden items-center gap-1 sm:flex">
          <ReputationStars reputation={gameState.company.reputation} />
          <span className="ml-1 text-xs text-muted-foreground">
            Lvl {gameState.company.level} · {tierProgress.current.label}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <motion.div
              key={Math.round(gameState.company.balance)}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`text-sm font-semibold tabular-nums ${
                flashSign === 'positive'
                  ? 'text-success'
                  : flashSign === 'negative'
                    ? 'text-destructive'
                    : gameState.isBankrupt
                      ? 'text-destructive'
                      : 'text-foreground'
              }`}
              title="Company balance"
            >
              ${Math.round(animatedBalance).toLocaleString()}
            </motion.div>
            <FloatingDelta deltas={balanceDeltas} />
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">
            {new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(
              gameState.currentDate,
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground" title="New Game">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new company?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {gameState.company.name} — crew, gear, finances,
                  and reputation. There is no undo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep playing</AlertDialogCancel>
                <AlertDialogAction onClick={resetGame}>Delete save & restart</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            onClick={advanceDay}
            size="sm"
            disabled={gameState.isGameOver || !gameState.hasCompletedOnboarding}
          >
            <Play className="mr-2 h-4 w-4" />
            {gameState.isGameOver
              ? 'Game Over'
              : gameState.hasCompletedOnboarding
                ? 'Next Day'
                : 'Finish Setup'}
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left icon nav rail */}
        <nav className="sticky top-14 flex h-[calc(100vh-3.5rem-2rem)] w-16 shrink-0 flex-col items-center gap-1 border-r bg-card/50 py-4">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex w-12 flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Page content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Bottom news ticker */}
      <footer className="sticky bottom-0 z-30 h-8 shrink-0 overflow-hidden border-t bg-card/95 backdrop-blur">
        <div className="animate-marquee whitespace-nowrap py-1.5 text-xs text-muted-foreground">
          {tickerText}
        </div>
      </footer>
    </div>
  );
}
