import { useGame } from '@/contexts/GameContext';
import { StatCard } from '@/components/StatCard';
import { EventCard } from '@/components/EventCard';
import { DollarSign, TrendingUp, Users, Calendar, Play, AlertTriangle, Wrench, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { Badge } from '@/components/ui/badge';
import { CompanyOnboardingDialog } from '@/components/CompanyOnboardingDialog';
import type { Company, MarketNewsTone } from '@/types/game';

export default function Dashboard() {
  const { gameState, advanceDay, completeCompanyOnboarding } = useGame();
  const navigate = useNavigate();
  const financialSummary = useFinancialSummary();

  const specializationLabels: Record<Company['specialization'], string> = {
    audio: 'Audio Specialist',
    lighting: 'Lighting Studio',
    video: 'Video Studio',
    stage: 'Stage Ops',
    balanced: 'Balanced Studio',
  };
  const marketToneClasses: Record<MarketNewsTone, string> = {
    info: 'bg-muted text-muted-foreground',
    positive: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  };
  const marketToneLabels: Record<MarketNewsTone, string> = {
    info: 'Update',
    positive: 'Positive',
    warning: 'Watch',
  };

  const upcomingEvents = gameState.events
    .filter(e => e.status === 'planned' || e.status === 'available')
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);

  const activeCrew = gameState.crew.filter(c => !c.assignedTo).length;
  const recentEvents = gameState.events
    .filter(e => e.status === 'completed')
    .slice(-5);

  const avgSatisfaction = recentEvents.length > 0
    ? recentEvents.reduce((sum, e) => sum + (e.clientSatisfaction || 0), 0) / recentEvents.length
    : 0;

  const lastThirtyNet = financialSummary.thirtyDay.net;
  const lastThirtyIncome = financialSummary.thirtyDay.incomeCount;
  const lastThirtyExpenses = financialSummary.thirtyDay.expenseCount;
  const recentTransactions = financialSummary.sortedTransactions.slice(0, 5);
  const financeAlerts = financialSummary.alerts.filter(alert => alert.key !== 'bankrupt');
  const topCategories = financialSummary.categorySummary.slice(0, 2);

  const completedReports = [...gameState.events]
    .filter(event => Boolean(event.postEventReport))
    .sort((a, b) => {
      const aTime = a.postEventReport?.completedOn.getTime() ?? 0;
      const bTime = b.postEventReport?.completedOn.getTime() ?? 0;
      return bTime - aTime;
    });

  const latestReportEvent = completedReports[0];
  const latestReport = latestReportEvent?.postEventReport;
  const competitorSnapshots = [...gameState.competitors].sort(
    (a, b) => b.reputation - a.reputation,
  );
  const marketHighlights = [...gameState.marketNews]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);
  const onboardingInitialValues = {
    name: gameState.company.name,
    brandColor: gameState.company.brandColor,
    accentColor: gameState.company.accentColor,
    specialization: gameState.company.specialization,
    tagline: gameState.company.tagline,
  };
  const specializationLabel = specializationLabels[gameState.company.specialization];
  const brandBadgeStyle = {
    backgroundColor: gameState.company.brandColor,
    color: '#fff',
    borderColor: 'transparent',
  } as const;
  const taglineStyle = {
    color: gameState.company.accentColor,
  } as const;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <>
      <CompanyOnboardingDialog
        open={!gameState.hasCompletedOnboarding}
        initialValues={onboardingInitialValues}
        onComplete={completeCompanyOnboarding}
        disableClose={!gameState.hasCompletedOnboarding}
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold" style={{ color: gameState.company.brandColor }}>
                  {gameState.company.name}
                </h1>
                <Badge style={brandBadgeStyle}>{specializationLabel}</Badge>
              </div>
              {gameState.company.tagline && gameState.company.tagline.length > 0 && (
                <p className="text-sm font-medium" style={taglineStyle}>
                  {gameState.company.tagline}
                </p>
              )}
              <p className="text-muted-foreground">
                {format(gameState.currentDate, 'EEEE, MMMM dd, yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={advanceDay}
                variant="outline"
                disabled={gameState.isBankrupt || !gameState.hasCompletedOnboarding}
              >
                <Play className="mr-2 h-4 w-4" />
                {gameState.isBankrupt
                  ? 'Resolve Bankruptcy'
                  : gameState.hasCompletedOnboarding
                    ? 'Next Day'
                    : 'Finish Setup'}
              </Button>
            </div>
          </div>

        {gameState.isBankrupt && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Bankruptcy in Effect</AlertTitle>
            <AlertDescription>
              Balance has fallen below the credit limit. Clear outstanding debts from the Finances view to resume operations.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Balance"
            value={`$${gameState.company.balance.toLocaleString()}`}
            icon={DollarSign}
            iconClassName="text-success"
            trend={{
              value:
                lastThirtyNet >= 0
                  ? 'Positive cash flow this month'
                  : 'Negative cash flow this month',
              positive: lastThirtyNet >= 0,
            }}
          />
          <StatCard
            title="Reputation"
            value={`${gameState.company.reputation}%`}
            icon={TrendingUp}
            iconClassName="text-primary"
            trend={{ value: `Avg ${avgSatisfaction.toFixed(0)}% satisfaction`, positive: avgSatisfaction > 70 }}
          />
          <StatCard
            title="30 Day Net"
            value={`${lastThirtyNet >= 0 ? '+' : '-'}$${Math.abs(lastThirtyNet).toLocaleString()}`}
            icon={TrendingUp}
            iconClassName={lastThirtyNet >= 0 ? 'text-success' : 'text-destructive'}
            trend={{
              value: `${lastThirtyIncome} income / ${lastThirtyExpenses} expenses`,
              positive: lastThirtyNet >= 0,
            }}
          />
          <StatCard
            title="Available Crew"
            value={`${activeCrew} / ${gameState.crew.length}`}
            icon={Users}
            iconClassName="text-audio"
          />
          <StatCard
            title="Active Events"
            value={upcomingEvents.length}
            icon={Calendar}
            iconClassName="text-accent"
          />
        </div>

        {financeAlerts.length > 0 && (
          <div className="space-y-2">
            {financeAlerts.map(alert => (
              <Alert key={alert.key} variant={alert.variant}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No upcoming events. Check the calendar for available contracts.
                </p>
              ) : (
                upcomingEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={() => navigate(`/event/${event.id}`)}
                    compact
                  />
                ))
              )}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                View All Events
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Browse Available Contracts
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/crew')}
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Crew
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/inventory')}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Manage Equipment
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate('/finances')}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Review Finances
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Landscape</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rival studios currently scouting the same market.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {competitorSnapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No competitors have surfaced yet. Progress a few days to reveal the field.
                </p>
              ) : (
                competitorSnapshots.map(competitor => {
                  const rateDelta = Math.round((competitor.baseRateModifier - 1) * 100);
                  const rateBadge =
                    rateDelta === 0
                      ? 'Market rate bids'
                      : rateDelta > 0
                        ? `~+${rateDelta}% premium`
                        : `${rateDelta}% below market`;
                  const bookedCount = competitor.scheduledEvents.filter(
                    event => event.status === 'booked',
                  ).length;

                  return (
                    <div
                      key={competitor.id}
                      className="rounded-lg border p-4 shadow-sm"
                      style={{ borderLeft: `4px solid ${competitor.brandColor}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold" style={{ color: competitor.brandColor }}>
                            {competitor.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Reputation {competitor.reputation}% • Reliability {competitor.reliability}%
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: competitor.brandColor, color: competitor.brandColor }}
                        >
                          {rateBadge}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {competitor.specialties.map(dept => (
                          <Badge key={`${competitor.id}-${dept}`} variant="secondary" className="capitalize">
                            {dept}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Active bids: {competitor.activeBids.length}</span>
                        <span>Booked shows: {bookedCount}</span>
                      </div>
                      {competitor.scoutingNotes.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {competitor.scoutingNotes.slice(0, 2).map(note => (
                            <li key={`${competitor.id}-note-${note}`}>• {note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Market Activity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Signals from the booking scene over the past few days.
                </p>
              </div>
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Megaphone className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {marketHighlights.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notable headlines yet. Close events or advance time to populate the ticker.
                </p>
              ) : (
                marketHighlights.map(item => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold leading-snug">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {format(item.date, 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`border-0 ${marketToneClasses[item.tone]} px-2 py-1`}
                      >
                        {marketToneLabels[item.tone]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {latestReport && latestReportEvent && (
          <Card>
            <CardHeader>
              <CardTitle>Post-Event Equipment Report</CardTitle>
              <p className="text-sm text-muted-foreground">
                {latestReportEvent.name} • Completed {format(latestReport.completedOn, 'MMM dd, yyyy')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Client Satisfaction</div>
                  <div className="text-lg font-semibold">{latestReport.satisfaction}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Net Result</div>
                  <div
                    className={`text-lg font-semibold ${
                      latestReport.financial.net >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {latestReport.financial.net >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(latestReport.financial.net))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Balance After Payout</div>
                  <div className="text-lg font-semibold">{formatCurrency(latestReport.financial.balanceAfter)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                  <Wrench className="h-4 w-4" /> Equipment Wear
                </div>
                {latestReport.equipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No equipment was assigned to this contract.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {latestReport.equipment.slice(0, 4).map(item => {
                      const drop = item.conditionBefore - item.conditionAfter;
                      const needsService = item.conditionAfter <= 60;
                      return (
                        <div
                          key={item.equipmentId}
                          className="rounded-lg border border-border/70 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                -{drop}% wear • {item.conditionAfter}% remaining
                              </div>
                            </div>
                            {needsService && <Badge variant="destructive">Maintenance Soon</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {latestReport.equipment.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{latestReport.equipment.length - 4} additional items recorded in the full report.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate(`/event/${latestReportEvent.id}`)}>
                  Review Event Details
                </Button>
                <Button variant="ghost" onClick={() => navigate('/inventory')}>
                  Open Inventory
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {(recentEvents.length > 0 || recentTransactions.length > 0 || topCategories.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-3">
                {recentEvents.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
                      Completed Events
                    </h3>
                    {recentEvents.map(event => (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{event.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(event.date, 'MMM dd')} • {event.venue}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-success">
                            ${event.clientPay.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {event.clientSatisfaction}% satisfaction
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {recentTransactions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
                      Ledger Entries
                    </h3>
                    {recentTransactions.map(txn => (
                      <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{txn.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(txn.date, 'MMM dd')} • {txn.category}
                          </div>
                        </div>
                        <div className={`font-semibold ${txn.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {txn.type === 'income' ? '+' : '-'}${txn.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/finances')}>
                      Open Finances
                    </Button>
                  </div>
                )}

                {topCategories.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
                      Cashflow Highlights
                    </h3>
                    {topCategories.map(category => (
                      <div key={category.category} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{category.category}</span>
                          <span className={`font-semibold ${category.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {category.net >= 0 ? '+' : '-'}${Math.abs(category.net).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          +${category.income.toLocaleString()} / -${category.expenses.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  );
}
