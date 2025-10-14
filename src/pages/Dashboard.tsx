import { useGame } from '@/contexts/GameContext';
import { StatCard } from '@/components/StatCard';
import { EventCard } from '@/components/EventCard';
import { DollarSign, TrendingUp, Users, Calendar, Play, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { gameState, advanceDay } = useGame();
  const navigate = useNavigate();
  
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

  const thirtyDaysAgo = new Date(gameState.currentDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTransactions = [...gameState.finances.transactions]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const lastThirty = gameState.finances.transactions.filter(t => t.date >= thirtyDaysAgo);
  const lastThirtyNet = lastThirty.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
    0
  );
  const lastThirtyIncome = lastThirty.filter(t => t.type === 'income').length;
  const lastThirtyExpenses = lastThirty.filter(t => t.type === 'expense').length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{gameState.company.name}</h1>
            <p className="text-muted-foreground">
              {format(gameState.currentDate, 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={advanceDay} variant="outline" disabled={gameState.isBankrupt}>
              <Play className="mr-2 h-4 w-4" />
              {gameState.isBankrupt ? 'Resolve Bankruptcy' : 'Next Day'}
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
            trend={{ value: '+12% from last month', positive: true }}
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
                onClick={() => navigate('/finances')}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Review Finances
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        {(recentEvents.length > 0 || recentTransactions.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
