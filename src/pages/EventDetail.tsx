import { useGame } from '@/contexts/GameContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CrewMemberCard } from '@/components/CrewMemberCard';
import { EquipmentCard } from '@/components/EquipmentCard';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { ArrowLeft, Calendar, MapPin, DollarSign, Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  calculateEventCost,
  calculateEventProfit,
  getCrewRecoveryDays,
  getEventTimeWindow,
  isEventFullyStaffed,
  isEventEquipmentReady,
} from '@/lib/gameData';
import { getEquipmentDefinition } from '@/lib/equipment';
import {
  CrewMember,
  Department,
  EquipmentItem,
  CrisisSeverity,
} from '@/types/game';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function EventDetail() {
  const { id } = useParams();
  const {
    gameState,
    assignCrewToEvent,
    unassignCrewFromEvent,
    assignEquipmentToEvent,
    unassignEquipmentFromEvent,
    acceptEvent,
    completeEvent,
    respondToCrisisPrompt,
  } = useGame();
  const navigate = useNavigate();
  
  const event = gameState.events.find(e => e.id === id);

  if (!event) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
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

  const postEventReport = event.postEventReport;
  const cost = calculateEventCost(event);
  const profit = calculateEventProfit(event);
  const isStaffed = isEventFullyStaffed(event);
  const equipmentReady = isEventEquipmentReady(event);
  const readyToAccept = isStaffed && equipmentReady;
  const availableCrew = gameState.crew.filter(c => !c.assignedTo);
  const equipmentByDepartment = gameState.equipment.reduce<Record<Department, EquipmentItem[]>>(
    (acc, item) => {
      acc[item.department].push(item);
      return acc;
    },
    { audio: [], lighting: [], video: [], stage: [] },
  );

  const { setupStart, eventStart, teardownComplete } = getEventTimeWindow(event);
  const recoveryDays = getCrewRecoveryDays(event);

  const fatigueThreshold = 85;

  const getCrewHelperText = (crew: CrewMember) => {
    const isTraveling = new Date(crew.availableOn) > eventStart;
    if (isTraveling) {
      return `Available ${format(crew.availableOn, 'MMM dd')}`;
    }
    if (crew.fatigue >= fatigueThreshold) {
      return 'Fatigue too high';
    }
    return undefined;
  };

  const getEquipmentHelperText = (equipment: EquipmentItem) => {
    if (equipment.maintenanceDue < eventStart) {
      return 'Maintenance due before show';
    }
    if (equipment.rentalInfo && equipment.rentalInfo.returnDate < eventStart) {
      return `Rental returns ${format(equipment.rentalInfo.returnDate, 'MMM dd')}`;
    }
    return undefined;
  };

  const totalHours = event.setupHours + event.eventHours + event.teardownHours;
  const crewReadyDate = new Date(event.date);
  crewReadyDate.setDate(crewReadyDate.getDate() + recoveryDays);

  const crisisPrompts = gameState.crises.filter(prompt => prompt.eventId === event.id);

  const severityStyles: Record<CrisisSeverity, string> = {
    low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    high: 'bg-destructive/10 text-destructive',
  };

  const stageLabels = {
    planning: 'Planning',
    execution: 'Execution',
  } as const;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const handleResolveCrisis = (promptId: string, choiceId: string) => {
    const result = respondToCrisisPrompt(promptId, choiceId);
    if (!result.success) {
      toast.error('Unable to lock response', {
        description: result.reason,
      });
      return;
    }
    toast.success('Contingency locked in');
  };

  const handleAcceptEvent = () => {
    if (gameState.isBankrupt) {
      toast.error('Unable to accept contract', {
        description: 'Your company is bankrupt. Resolve finances to take on new work.',
      });
      return;
    }

    if (!isStaffed) {
      toast.error('Cannot accept event', {
        description: 'Please assign all required crew members first',
      });
      return;
    }
    if (!equipmentReady) {
      toast.error('Cannot accept event', {
        description: 'Reserve the required equipment before confirming.',
      });
      return;
    }
    acceptEvent(event.id);
    toast.success('Event accepted!', {
      description: `${event.name} has been added to your schedule`,
    });
  };
  
  const handleCompleteEvent = () => {
    if (gameState.isBankrupt) {
      toast.error('Unable to complete event', {
        description: 'Resolve bankruptcy status before completing contracts.',
      });
      return;
    }

    // Simplified completion - in full game this would be based on actual execution
    const baseSatisfaction = 75;
    const crewQualityBonus = Math.min(
      15,
      Object.values(event.assignedCrew)
        .flat()
        .reduce((sum, c) => sum + c.skillLevel, 0) / 2,
    );
    const provisionalSatisfaction = Math.min(100, baseSatisfaction + crewQualityBonus);

    const result = completeEvent(event.id, provisionalSatisfaction);
    const finalSatisfaction = result?.satisfaction ?? provisionalSatisfaction;
    toast.success('Event completed!', {
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
      const message = `${outcome.title} (${stageLabels[outcome.stage]})`;
      const financialImpact =
        outcome.financialDelta !== 0
          ? ` • Financial impact: ${formatCurrency(Math.abs(outcome.financialDelta))} ${
              outcome.financialDelta > 0 ? 'expense' : 'savings'
            }`
          : '';
      const description = `${outcome.resolution}. ${outcome.notes ?? ''}${financialImpact}`;

      if (hasPenalty) {
        toast.warning(message, {
          description,
        });
      } else {
        toast.success(message, {
          description,
        });
      }
    });

    if (result?.financial.isBankrupt) {
      toast.error('Bankruptcy triggered', {
        description: 'Balance fell below the credit limit. Visit Finances to resolve.',
      });
    }
    navigate('/');
  };
  
  const handleAssignCrew = (crewId: string, department: Department) => {
    const currentAssigned = event.assignedCrew[department].length;
    if (currentAssigned >= event.requirements[department]) {
      toast.error('Department is fully staffed', {
        description: `${department} department already has all required crew`,
      });
      return;
    }
    const result = assignCrewToEvent(event.id, crewId, department);
    if (!result.success) {
      toast.error('Unable to assign crew', {
        description: result.reason,
      });
      return;
    }
    toast.success('Crew assigned');
  };
  
  const handleUnassignCrew = (crewId: string) => {
    unassignCrewFromEvent(event.id, crewId);
    toast.success('Crew unassigned');
  };

  const handleAssignEquipment = (equipmentId: string, department: Department) => {
    const result = assignEquipmentToEvent(event.id, equipmentId, department);
    if (!result.success) {
      toast.error('Unable to reserve equipment', {
        description: result.reason,
      });
      return;
    }
    toast.success('Equipment reserved');
  };

  const handleUnassignEquipment = (equipmentId: string, department: Department) => {
    unassignEquipmentFromEvent(event.id, equipmentId, department);
    toast.success('Equipment released');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/calendar')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{event.name}</h1>
                <Badge className={event.type === 'festival' ? 'bg-video' : event.type === 'tour' ? 'bg-accent' : 'bg-primary'}>
                  {event.type.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(event.date, 'MMMM dd, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.venue}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {totalHours} hours
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {event.status === 'available' && (
              <Button onClick={handleAcceptEvent} disabled={!readyToAccept}>
                {readyToAccept ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept Event
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    {!isStaffed ? 'Assign Crew' : 'Reserve Equipment'}
                  </>
                )}
              </Button>
            )}
            {event.status === 'planned' && (
              <Button onClick={handleCompleteEvent}>
                Complete Event (Demo)
              </Button>
            )}
          </div>
        </div>

        {gameState.isBankrupt && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Company Bankrupt</AlertTitle>
            <AlertDescription>
              Financial status prevents progressing this event. Clear debts in the Finances panel to continue.
            </AlertDescription>
          </Alert>
        )}

        {event.status === 'completed' && postEventReport && (
          <Card>
            <CardHeader>
              <CardTitle>Post-Event Report</CardTitle>
              <p className="text-sm text-muted-foreground">
                Closed on {format(postEventReport.completedOn, 'MMM dd, yyyy')} • Balance after payout{' '}
                {formatCurrency(postEventReport.financial.balanceAfter)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Client Satisfaction</div>
                  <div className="text-lg font-semibold">{postEventReport.satisfaction}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Income</div>
                  <div className="text-lg font-semibold text-success">
                    +{formatCurrency(postEventReport.financial.income)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Expenses</div>
                  <div className="text-lg font-semibold text-destructive">
                    -{formatCurrency(postEventReport.financial.expense)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> Equipment Condition Highlights
                </div>
                {postEventReport.equipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No equipment assignments were logged against this show.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {postEventReport.equipment.map(item => {
                      const wear = item.conditionBefore - item.conditionAfter;
                      const needsService = item.conditionAfter <= 60;
                      return (
                        <div key={item.equipmentId} className="rounded-lg border border-border/70 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.conditionBefore}% → {item.conditionAfter}% ({wear}% wear)
                              </div>
                            </div>
                            {needsService && <Badge variant="destructive">Schedule Service</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financial Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Client Pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ${event.clientPay.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                -${cost.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projected Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profit > 0 ? 'text-success' : 'text-destructive'}`}>
                ${profit.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Event Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Setup</div>
                <div className="text-2xl font-bold">{event.setupHours}h</div>
              </div>
              <div className="h-px flex-1 bg-border mx-4" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Event</div>
                <div className="text-2xl font-bold">{event.eventHours}h</div>
              </div>
              <div className="h-px flex-1 bg-border mx-4" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Teardown</div>
                <div className="text-2xl font-bold">{event.teardownHours}h</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <div className="text-muted-foreground">Setup begins</div>
                <div className="font-medium">{format(setupStart, 'MMM dd, h a')}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Showtime</div>
                <div className="font-medium">{format(eventStart, 'MMM dd, h a')}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Crew cleared</div>
                <div className="font-medium">{format(teardownComplete, 'MMM dd, h a')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logistics & Recovery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <div className="text-muted-foreground">Travel Buffer</div>
                <div className="text-lg font-semibold">{event.travelHours} hrs</div>
              </div>
              <div>
                <div className="text-muted-foreground">Required Recovery</div>
                <div className="text-lg font-semibold">{recoveryDays} days</div>
              </div>
              <div>
                <div className="text-muted-foreground">Crew ready by</div>
                <div className="text-lg font-semibold">{format(crewReadyDate, 'MMM dd')}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Crew cannot be reassigned until after recovery. High fatigue or overlapping travel windows will block assignments.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk & Crisis Preparation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Resolve risks ahead of load-in. Your choices affect client satisfaction and surprise costs.
            </p>
          </CardHeader>
          <CardContent>
            {crisisPrompts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No active risks detected. Keep confirming call sheets and checklists.
              </div>
            ) : (
              <div className="space-y-5">
                {crisisPrompts.map(prompt => {
                  const selectedChoice = prompt.selectedChoiceId
                    ? prompt.choices.find(choice => choice.id === prompt.selectedChoiceId)
                    : undefined;
                  const recommended = prompt.recommendedActions.join(' • ');
                  const baseImpact = `Potential impact: -${prompt.baseSatisfactionPenalty} satisfaction${
                    prompt.baseFinancialPenalty
                      ? `, ${formatCurrency(prompt.baseFinancialPenalty)} expense`
                      : ''
                  }`;
                  const canResolve = event.status === 'planned' || event.status === 'in-progress';

                  return (
                    <div key={prompt.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={severityStyles[prompt.severity]}>
                              {prompt.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{stageLabels[prompt.stage]}</Badge>
                          </div>
                          <h3 className="text-lg font-semibold">{prompt.title}</h3>
                          <p className="text-sm text-muted-foreground">{prompt.description}</p>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {baseImpact}
                          </p>
                          <p className="text-xs text-muted-foreground">Recommended: {recommended}</p>
                        </div>
                        {prompt.resolved && selectedChoice && (
                          <Badge className="bg-primary/10 text-primary">{selectedChoice.label}</Badge>
                        )}
                      </div>

                      {!prompt.resolved && (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {prompt.choices.map(choice => (
                            <Button
                              key={choice.id}
                              variant="outline"
                              className="justify-start text-left"
                              disabled={!canResolve}
                              onClick={() => handleResolveCrisis(prompt.id, choice.id)}
                            >
                              <div>
                                <div className="font-semibold">{choice.label}</div>
                                <div className="text-xs text-muted-foreground">{choice.description}</div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}

                      {prompt.resolved && selectedChoice && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Resolution locked: {selectedChoice.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crew Assignment */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Department Requirements */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Crew Requirements</h2>
            
            {(['audio', 'lighting', 'video', 'stage'] as Department[]).map(dept => {
              const required = event.requirements[dept];
              const assigned = event.assignedCrew[dept];
              
              if (required === 0) return null;
              
              return (
                <Card key={dept}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <DepartmentBadge department={dept} />
                      <span className={`text-sm ${assigned.length >= required ? 'text-success' : 'text-warning'}`}>
                        {assigned.length} / {required} assigned
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {assigned.length > 0 ? (
                      <div className="space-y-2">
                        {assigned.map(crew => (
                          <div key={crew.id} className="flex items-center justify-between p-2 border rounded">
                            <span className="font-medium">{crew.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Lvl {crew.skillLevel}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnassignCrew(crew.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No crew assigned
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Available Crew */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Available Crew</h2>
            
            {(['audio', 'lighting', 'video', 'stage'] as Department[]).map(dept => {
              const deptCrew = availableCrew.filter(c => c.department === dept);
              const required = event.requirements[dept];
              
              if (required === 0 || deptCrew.length === 0) return null;
              
              return (
                <div key={dept} className="space-y-2">
                  <DepartmentBadge department={dept} />
                  <div className="grid gap-2">
                    {deptCrew.map(crew => {
                      const helperText = getCrewHelperText(crew);
                      const isDisabled = Boolean(helperText);
                      return (
                        <CrewMemberCard
                          key={crew.id}
                          crew={crew}
                          onSelect={() => handleAssignCrew(crew.id, dept)}
                          compact
                          disabled={isDisabled}
                          helperText={helperText}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {availableCrew.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">All crew members are assigned</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Equipment Planning */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Equipment Requirements</h2>

            {(['audio', 'lighting', 'video', 'stage'] as Department[]).map(dept => {
              const requirements = event.equipmentRequirements[dept];
              if (!requirements || requirements.length === 0) return null;

              const requiredCount = requirements.reduce((sum, req) => sum + req.quantity, 0);
              const assignedItems = event.assignedEquipment[dept]
                .map(id => gameState.equipment.find(item => item.id === id))
                .filter((item): item is EquipmentItem => Boolean(item));

              return (
                <Card key={`equipment-${dept}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <DepartmentBadge department={dept} />
                      <span
                        className={`text-sm ${
                          assignedItems.length >= requiredCount ? 'text-success' : 'text-warning'
                        }`}
                      >
                        {assignedItems.length} / {requiredCount} reserved
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {requirements.map(req => {
                        const definition = getEquipmentDefinition(req.type);
                        return (
                          <div
                            key={req.id}
                            className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                          >
                            <span className="font-medium text-foreground">{definition.name}</span>
                            <span>{req.quantity}×</span>
                          </div>
                        );
                      })}
                    </div>

                    {assignedItems.length > 0 ? (
                      <div className="space-y-2">
                        {assignedItems.map(item => (
                          <EquipmentCard
                            key={item.id}
                            equipment={item}
                            helperText={`Condition ${item.condition}%`}
                            onRemove={() => handleUnassignEquipment(item.id, dept)}
                            removeLabel="Release"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No equipment reserved
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Available Equipment</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/inventory')}>
                Manage Inventory
              </Button>
            </div>

            {(['audio', 'lighting', 'video', 'stage'] as Department[]).map(dept => {
              const requirements = event.equipmentRequirements[dept];
              if (!requirements || requirements.length === 0) return null;

              const availableItems = equipmentByDepartment[dept].filter(item => item.status === 'available');
              if (availableItems.length === 0) {
                return (
                  <div key={`available-${dept}`} className="space-y-2">
                    <DepartmentBadge department={dept} />
                    <p className="text-sm text-muted-foreground">
                      No idle inventory. Visit the inventory view to rent additional gear.
                    </p>
                  </div>
                );
              }

              return (
                <div key={`available-${dept}`} className="space-y-2">
                  <DepartmentBadge department={dept} />
                  <div className="grid gap-2">
                    {availableItems.map(item => {
                      const helperText = getEquipmentHelperText(item);
                      const isDisabled = Boolean(helperText);
                      return (
                        <EquipmentCard
                          key={item.id}
                          equipment={item}
                          onSelect={() => handleAssignEquipment(item.id, dept)}
                          helperText={helperText}
                          disabled={isDisabled}
                          actionLabel="Reserve"
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
