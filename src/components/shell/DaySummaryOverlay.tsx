import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Moon, AlertTriangle } from 'lucide-react';
import type { DaySummary } from '@/lib/daySummary';
import type { MarketNewsTone } from '@/types/game';

interface DaySummaryOverlayProps {
  summary: DaySummary;
  onContinue: () => void;
}

const toneClasses: Record<MarketNewsTone, string> = {
  info: 'bg-muted text-muted-foreground',
  positive: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

export function DaySummaryOverlay({ summary, onContinue }: DaySummaryOverlayProps) {
  const netCategoryTotals = summary.newTransactions.reduce((acc, txn) => {
    const signed = txn.type === 'income' ? txn.amount : -txn.amount;
    acc[txn.category] = (acc[txn.category] ?? 0) + signed;
    return acc;
  }, {} as Record<string, number>);
  const categoryEntries = Object.entries(netCategoryTotals);

  const isQuietNight =
    summary.newTransactions.length === 0 &&
    summary.newNews.length === 0 &&
    summary.reputationDelta === 0 &&
    summary.moraleShiftsCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      // The backdrop is the "night sweep" — it lands first and fast; the
      // card itself springs in a beat later so the day genuinely feels like
      // it closes before the recap opens.
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Overnight summary"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: 'easeOut' }}
        className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Moon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {format(summary.date, 'EEEE, MMMM dd')}
            </h2>
            <p className="text-sm text-muted-foreground">While you slept…</p>
          </div>
        </div>

        {summary.becameBankrupt && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            The company slipped into bankruptcy overnight.
          </div>
        )}

        {isQuietNight ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            A quiet night. Nothing moved.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Cash</div>
                <div
                  className={`flex items-center gap-1 text-lg font-semibold ${
                    summary.balanceDelta >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {summary.balanceDelta >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {summary.balanceDelta >= 0 ? '+' : '-'}$
                  {Math.abs(Math.round(summary.balanceDelta)).toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Reputation</div>
                <div
                  className={`text-lg font-semibold ${
                    summary.reputationDelta > 0
                      ? 'text-success'
                      : summary.reputationDelta < 0
                        ? 'text-destructive'
                        : ''
                  }`}
                >
                  {summary.reputationDelta > 0 ? '+' : ''}
                  {summary.reputationDelta}
                </div>
              </div>
            </div>

            {categoryEntries.length > 0 && (
              <div className="space-y-1.5">
                {categoryEntries.map(([category, net]) => (
                  <div key={category} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{category}</span>
                    <span className={net >= 0 ? 'text-success' : 'text-destructive'}>
                      {net >= 0 ? '+' : '-'}${Math.abs(Math.round(net)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {summary.moraleShiftsCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {summary.moraleShiftsCount} crew member{summary.moraleShiftsCount === 1 ? '' : 's'}{' '}
                had a morale shift overnight.
              </p>
            )}

            {summary.newNews.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Market Activity
                </div>
                {summary.newNews.slice(0, 4).map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5">
                    <div>
                      <div className="text-sm font-medium leading-snug">{item.title}</div>
                      <p className="text-xs text-muted-foreground">{item.summary}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 border-0 text-xs ${toneClasses[item.tone]}`}>
                      {item.tone === 'positive' ? 'Good' : item.tone === 'warning' ? 'Watch' : 'News'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button className="mt-6 w-full" onClick={onContinue} autoFocus>
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}
