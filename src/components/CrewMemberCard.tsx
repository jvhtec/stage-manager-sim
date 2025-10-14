import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CrewMember } from '@/types/game';
import { DepartmentBadge } from './DepartmentBadge';
import { User, Battery, Heart, DollarSign } from 'lucide-react';

interface CrewMemberCardProps {
  crew: CrewMember;
  onSelect?: () => void;
  compact?: boolean;
  showAssignment?: boolean;
}

export function CrewMemberCard({ crew, onSelect, compact, showAssignment }: CrewMemberCardProps) {
  const skillStars = '★'.repeat(crew.skillLevel) + '☆'.repeat(10 - crew.skillLevel);
  
  if (compact) {
    return (
      <Card 
        className={`cursor-pointer hover:border-primary transition-colors ${crew.assignedTo ? 'opacity-50' : ''}`}
        onClick={onSelect}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{crew.name}</div>
                <div className="text-xs text-muted-foreground">{skillStars}</div>
              </div>
            </div>
            <DepartmentBadge department={crew.department} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${onSelect ? 'cursor-pointer hover:border-primary' : ''} transition-colors`} onClick={onSelect}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                {crew.name}
              </h4>
              <div className="text-xs text-muted-foreground mt-1">{skillStars}</div>
            </div>
            <DepartmentBadge department={crew.department} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Battery className="h-3 w-3" />
                <span className="text-xs">Energy</span>
              </div>
              <Progress value={100 - crew.fatigue} className="h-2" />
              <span className="text-xs text-muted-foreground">{100 - crew.fatigue}%</span>
            </div>
            
            <div>
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Heart className="h-3 w-3" />
                <span className="text-xs">Morale</span>
              </div>
              <Progress value={crew.morale} className="h-2" />
              <span className="text-xs text-muted-foreground">{crew.morale}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              ${crew.hourlyRate}/hr
            </span>
            {crew.assignedTo && showAssignment && (
              <Badge variant="secondary" className="text-xs">Assigned</Badge>
            )}
            {!crew.assignedTo && showAssignment && (
              <Badge variant="outline" className="text-xs">Available</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
