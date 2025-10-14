import { useGame } from '@/contexts/GameContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CrewMemberCard } from '@/components/CrewMemberCard';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { ArrowLeft, Calendar, MapPin, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { calculateEventCost, calculateEventProfit, isEventFullyStaffed } from '@/lib/gameData';
import { Department } from '@/types/game';
import { toast } from 'sonner';

export default function EventDetail() {
  const { id } = useParams();
  const { gameState, assignCrewToEvent, unassignCrewFromEvent, acceptEvent, completeEvent } = useGame();
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
  
  const cost = calculateEventCost(event);
  const profit = calculateEventProfit(event);
  const isStaffed = isEventFullyStaffed(event);
  const availableCrew = gameState.crew.filter(c => !c.assignedTo);
  
  const totalHours = event.setupHours + event.eventHours + event.teardownHours;
  
  const handleAcceptEvent = () => {
    if (!isStaffed) {
      toast.error('Cannot accept event', {
        description: 'Please assign all required crew members first',
      });
      return;
    }
    acceptEvent(event.id);
    toast.success('Event accepted!', {
      description: `${event.name} has been added to your schedule`,
    });
  };
  
  const handleCompleteEvent = () => {
    // Simplified completion - in full game this would be based on actual execution
    const baseSatisfaction = 75;
    const crewQualityBonus = Math.min(15, Object.values(event.assignedCrew).flat().reduce((sum, c) => sum + c.skillLevel, 0) / 2);
    const satisfaction = Math.min(100, baseSatisfaction + crewQualityBonus);
    
    completeEvent(event.id, satisfaction);
    toast.success('Event completed!', {
      description: `Client satisfaction: ${satisfaction}%`,
    });
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
    assignCrewToEvent(event.id, crewId, department);
    toast.success('Crew assigned');
  };
  
  const handleUnassignCrew = (crewId: string) => {
    unassignCrewFromEvent(event.id, crewId);
    toast.success('Crew unassigned');
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
              <Button onClick={handleAcceptEvent} disabled={!isStaffed}>
                {isStaffed ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept Event
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Assign All Crew
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
          <CardContent>
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
                    {deptCrew.map(crew => (
                      <CrewMemberCard
                        key={crew.id}
                        crew={crew}
                        onSelect={() => handleAssignCrew(crew.id, dept)}
                        compact
                      />
                    ))}
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
      </div>
    </div>
  );
}
