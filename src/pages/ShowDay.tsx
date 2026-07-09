import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Circle, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHOW_PHASES,
  calculatePreparationScore,
  getBaseSatisfactionFromPreparation,
  getPhaseForCrisisPrompt,
  getPreparationTier,
} from '@/lib/showDay';
import type { CrisisSeverity } from '@/types/game';

const severityStyles: Record<CrisisSeverity, string> = {
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  high: 'bg-destructive/10 text-destructive',
};

export default function ShowDay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gameState, respondToCrisisPrompt, completeEvent } = useGame();
  const [phaseIndex, setPhaseIndex] = useState(0);

  const event = gameState.events.find(e => e.id === id);

  if (!event) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Event not found</p>
              <Button className="mt-4" onClick={() => navigate('/calendar')}>
                Back to Calendar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (event.status !== 'planned' && event.status !== 'in-progress') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="space-y-4 py-12 text-center">
              <p className="text-muted-foreground">
                {event.status === 'completed'
                  ? 'This show has already wrapped.'
                  : 'This show is not on the calendar as a live booking.'}
              </p>
              <Button onClick={() => navigate(`/event/${event.id}`)}>Back to Event</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const preparationScore = calculatePreparationScore(event, gameState.crew, gameState.equipment);
  const baseSatisfaction = getBaseSatisfactionFromPreparation(preparationScore);
  const preparationTier = getPreparationTier(preparationScore);

  const executionCrises = gameState.crises.filter(
    prompt => prompt.eventId === event.id && prompt.stage === 'execution',
  );

  const currentPhase = SHOW_PHASES[phaseIndex];
  const phaseCrises = executionCrises.filter(
    prompt => getPhaseForCrisisPrompt(prompt.id) === currentPhase.id,
  );
  const unresolvedPhaseCrises = phaseCrises.filter(prompt => !prompt.resolved);
  const isLastPhase = phaseIndex === SHOW_PHASES.length - 1;

  const handleResolve = (promptId: string, choiceId: string) => {
    const result = respondToCrisisPrompt(promptId, choiceId);
    if (!result.success) {
      toast.error('Unable to lock response', { description: result.reason });
      return;
    }
    toast.success('Call made — the show continues');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const finishShow = () => {
    if (gameState.isBankrupt) {
      toast.error('Unable to complete show', {
        description: 'Resolve bankruptcy status before wrapping contracts.',
      });
      return;
    }

    const result = completeEvent(event.id, baseSatisfaction);
    const finalSatisfaction = result?.satisfaction ?? baseSatisfaction;
    toast.success('Show complete!', {
      description: `Client satisfaction: ${finalSatisfaction}%`,
    });

    result?.crewResults.forEach(outcome => {
      if (outcome.leveledUp) {
        toast.success(`${outcome.crewName} leveled up!`, {
          description: `Now level ${outcome.newSkillLevel}${outcome.newCertification ? ` • Earned ${outcome.newCertification}` : ''}`,
        });
      } else if (outcome.newCertification) {
        toast.success(`${outcome.crewName} earned ${outcome.newCertification}`);
      } else if (outcome.moraleDelta < 0) {
        toast.warning(`${outcome.crewName} is worn down`, {
          description: `Morale dropped by ${Math.abs(outcome.moraleDelta)}. Consider giving them rest.`,
        });
      }
    });

    result?.equipmentResults.forEach(equipment => {
      if (equipment.conditionAfter <= 40) {
        toast.warning(`${equipment.name} is wearing down`, {
          description: `Condition is at ${equipment.conditionAfter}%. Schedule maintenance soon.`,
        });
      }
    });

    result?.crisisOutcomes.forEach(outcome => {
      const hasPenalty = outcome.satisfactionDelta < 0 || outcome.financialDelta > 0;
      const message = `${outcome.title} (${outcome.stage === 'planning' ? 'Planning' : 'Execution'})`;
      const financialImpact =
        outcome.financialDelta !== 0
          ? ` • Financial impact: ${formatCurrency(Math.abs(outcome.financialDelta))} ${
              outcome.financialDelta > 0 ? 'expense' : 'savings'
            }`
          : '';
      const description = `${outcome.resolution}. ${outcome.notes ?? ''}${financialImpact}`;

      if (hasPenalty) {
        toast.warning(message, { description });
      } else {
        toast.success(message, { description });
      }
    });

    if (result?.financial.isBankrupt) {
      toast.error('Bankruptcy triggered', {
        description: 'Balance fell below the credit limit. Visit Finances to resolve.',
      });
    }

    navigate(`/event/${event.id}`);
  };

  const handleAdvance = () => {
    if (isLastPhase) {
      finishShow();
      return;
    }
    setPhaseIndex(index => index + 1);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(`/event/${event.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{event.name} — Show Day</h1>
            <p className="text-muted-foreground">{event.venue}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Show Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">{preparationScore}%</span>
                  <Badge className={severityStyles.low}>{preparationTier.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{preparationTier.description}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>Baseline satisfaction</div>
                <div className="text-2xl font-bold text-foreground">{baseSatisfaction}%</div>
                <div>before tonight's calls are factored in</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase stepper */}
        <div className="flex items-center gap-2">
          {SHOW_PHASES.map((phase, index) => (
            <div key={phase.id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                  index === phaseIndex
                    ? 'border-primary bg-primary/10 text-primary'
                    : index < phaseIndex
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-border text-muted-foreground'
                }`}
              >
                {index < phaseIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {phase.label}
              </div>
              {index < SHOW_PHASES.length - 1 && (
                <div className="h-px flex-1 bg-border" aria-hidden />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{currentPhase.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{currentPhase.description}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {phaseCrises.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing flagged for this phase. Systems nominal.
              </div>
            ) : (
              phaseCrises.map(prompt => {
                const selectedChoice = prompt.selectedChoiceId
                  ? prompt.choices.find(choice => choice.id === prompt.selectedChoiceId)
                  : undefined;

                return (
                  <div key={prompt.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <Badge className={severityStyles[prompt.severity]}>
                          {prompt.severity.toUpperCase()}
                        </Badge>
                        <h3 className="text-lg font-semibold">{prompt.title}</h3>
                        <p className="text-sm text-muted-foreground">{prompt.description}</p>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Potential impact: -{prompt.baseSatisfactionPenalty} satisfaction
                          {prompt.baseFinancialPenalty
                            ? `, ${formatCurrency(prompt.baseFinancialPenalty)} expense`
                            : ''}
                        </p>
                      </div>
                      {prompt.resolved && selectedChoice && (
                        <Badge className="bg-primary/10 text-primary">{selectedChoice.label}</Badge>
                      )}
                    </div>

                    {!prompt.resolved ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {prompt.choices.map(choice => (
                          <Button
                            key={choice.id}
                            variant="outline"
                            className="justify-start text-left"
                            onClick={() => handleResolve(prompt.id, choice.id)}
                          >
                            <div>
                              <div className="font-semibold">{choice.label}</div>
                              <div className="text-xs text-muted-foreground">{choice.description}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Resolution locked: {selectedChoice?.description}
                      </p>
                    )}
                  </div>
                );
              })
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                {unresolvedPhaseCrises.length > 0
                  ? 'Unaddressed calls still cost satisfaction and cash automatically when the show wraps.'
                  : 'This phase is clear.'}
              </p>
              <Button onClick={handleAdvance}>
                {isLastPhase ? (
                  <>
                    <PartyPopper className="mr-2 h-4 w-4" />
                    {unresolvedPhaseCrises.length > 0 ? 'Wrap Show Anyway' : 'Wrap the Show'}
                  </>
                ) : unresolvedPhaseCrises.length > 0 ? (
                  'Proceed Anyway'
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
