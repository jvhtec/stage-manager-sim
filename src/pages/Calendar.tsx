import { useGame } from '@/contexts/GameContext';
import { EventCard } from '@/components/EventCard';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function Calendar() {
  const { gameState } = useGame();
  const navigate = useNavigate();

  const availableEvents = gameState.events.filter(e => e.status === 'available');
  const plannedEvents = gameState.events.filter(e => e.status === 'planned');
  const inProgressEvents = gameState.events.filter(e => e.status === 'in-progress');
  const completedEvents = gameState.events.filter(e => e.status === 'completed');
  const failedEvents = gameState.events.filter(e => e.status === 'failed');

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Event Calendar</h1>
          <p className="text-muted-foreground">Manage your event schedule</p>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="available">
              Available ({availableEvents.length})
            </TabsTrigger>
            <TabsTrigger value="planned">
              Planned ({plannedEvents.length})
            </TabsTrigger>
            <TabsTrigger value="in-progress">
              In Progress ({inProgressEvents.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedEvents.length})
            </TabsTrigger>
            <TabsTrigger value="failed">
              Failed ({failedEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4 mt-6">
            {availableEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No available contracts at the moment</p>
                  <p className="text-sm text-muted-foreground">Check back later for new opportunities</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableEvents
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={() => navigate(`/event/${event.id}`)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="planned" className="space-y-4 mt-6">
            {plannedEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No planned events</p>
                  <p className="text-sm text-muted-foreground">Accept contracts to get started</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plannedEvents
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={() => navigate(`/event/${event.id}`)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4 mt-6">
            {inProgressEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No shows are live right now</p>
                  <p className="text-sm text-muted-foreground">Planned events move here on their show date</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inProgressEvents
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={() => navigate(`/event/${event.id}`)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-6">
            {completedEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed events yet</p>
                  <p className="text-sm text-muted-foreground">Complete some events to see your history</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedEvents
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={() => navigate(`/event/${event.id}`)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="failed" className="space-y-4 mt-6">
            {failedEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No lost or missed contracts</p>
                  <p className="text-sm text-muted-foreground">Contracts you lose to rivals or miss will show up here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {failedEvents
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={() => navigate(`/event/${event.id}`)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
