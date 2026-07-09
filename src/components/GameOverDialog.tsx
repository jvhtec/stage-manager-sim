import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skull } from 'lucide-react';
import { format } from 'date-fns';
import type { RunSummary } from '@/types/game';

interface GameOverDialogProps {
  open: boolean;
  companyName: string;
  runSummary?: RunSummary;
  onStartNewCompany: () => void;
}

export function GameOverDialog({ open, companyName, runSummary, onStartNewCompany }: GameOverDialogProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => event.preventDefault()}
        hideCloseButton
      >
        {/* Blocking dialog — no close affordance, only resolvable via Start a New Company */}
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Skull className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center text-2xl">{companyName} has folded</DialogTitle>
          <DialogDescription className="text-center">
            {runSummary?.reason ?? 'The company could not recover from its debts.'}
          </DialogDescription>
        </DialogHeader>

        {runSummary && (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 text-sm">
            <div>
              <div className="text-muted-foreground">Days survived</div>
              <div className="text-lg font-semibold">{runSummary.daysSurvived}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Shows completed</div>
              <div className="text-lg font-semibold">{runSummary.showsCompleted}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Peak balance</div>
              <div className="text-lg font-semibold text-success">
                {formatCurrency(runSummary.peakBalance)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Peak reputation</div>
              <div className="text-lg font-semibold">{Math.round(runSummary.peakReputation)}%</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Closed on</div>
              <div className="font-medium">{format(runSummary.endedOn, 'MMMM dd, yyyy')}</div>
            </div>
          </div>
        )}

        <Button className="w-full" onClick={onStartNewCompany}>
          Start a New Company
        </Button>
      </DialogContent>
    </Dialog>
  );
}
