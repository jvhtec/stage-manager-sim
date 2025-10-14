import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Event } from '@/types/game';
import { Calendar, MapPin, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';
import { isEventFullyStaffed } from '@/lib/gameData';

interface EventCardProps {
  event: Event;
  onSelect: () => void;
  compact?: boolean;
}

export function EventCard({ event, onSelect, compact }: EventCardProps) {
  const isStaffed = isEventFullyStaffed(event);
  const totalRequired = Object.values(event.requirements).reduce((a, b) => a + b, 0);
  const totalAssigned = Object.values(event.assignedCrew).flat().length;
  
  const statusColor = {
    available: 'bg-muted text-muted-foreground',
    planned: isStaffed ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground',
    'in-progress': 'bg-primary text-primary-foreground',
    completed: 'bg-success text-success-foreground',
    failed: 'bg-destructive text-destructive-foreground',
  };
  
  const typeColor = {
    gig: 'bg-primary/20 text-primary',
    tour: 'bg-accent/20 text-accent-foreground',
    festival: 'bg-video/20 text-video',
  };

  if (compact) {
    return (
      <Card className="cursor-pointer hover:border-primary transition-colors" onClick={onSelect}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold">{event.name}</h4>
                <Badge className={typeColor[event.type]}>{event.type}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(event.date, 'MMM dd')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.venue}
                </span>
              </div>
            </div>
            <Badge className={statusColor[event.status]}>
              {isStaffed ? 'Ready' : `${totalAssigned}/${totalRequired}`}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:border-primary transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CardTitle>{event.name}</CardTitle>
              <Badge className={typeColor[event.type]}>{event.type.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(event.date, 'MMMM dd, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.venue}
              </span>
            </div>
          </div>
          <Badge className={statusColor[event.status]}>
            {event.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Client Pay
            </span>
            <span className="font-semibold text-lg">
              ${event.clientPay.toLocaleString()}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              Crew Status
            </span>
            <span className={isStaffed ? 'text-success' : 'text-warning'}>
              {totalAssigned} / {totalRequired} assigned
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 pt-2">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Audio</div>
              <div className={`text-sm font-semibold ${
                event.assignedCrew.audio.length >= event.requirements.audio ? 'text-success' : 'text-warning'
              }`}>
                {event.assignedCrew.audio.length}/{event.requirements.audio}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Lighting</div>
              <div className={`text-sm font-semibold ${
                event.assignedCrew.lighting.length >= event.requirements.lighting ? 'text-success' : 'text-warning'
              }`}>
                {event.assignedCrew.lighting.length}/{event.requirements.lighting}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Video</div>
              <div className={`text-sm font-semibold ${
                event.assignedCrew.video.length >= event.requirements.video ? 'text-success' : 'text-warning'
              }`}>
                {event.assignedCrew.video.length}/{event.requirements.video}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Stage</div>
              <div className={`text-sm font-semibold ${
                event.assignedCrew.stage.length >= event.requirements.stage ? 'text-success' : 'text-warning'
              }`}>
                {event.assignedCrew.stage.length}/{event.requirements.stage}
              </div>
            </div>
          </div>
          
          <Button onClick={onSelect} className="w-full">
            {event.status === 'available' ? 'Plan Event' : 'View Details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
