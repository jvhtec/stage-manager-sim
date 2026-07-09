import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CrewMember } from '@/types/game';
import { DepartmentBadge } from './DepartmentBadge';
import { User, Battery, Heart, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { getExperienceThresholdForLevel } from '@/lib/crewProgression';

interface CrewMemberCardProps {
  crew: CrewMember;
  onSelect?: () => void;
  compact?: boolean;
  showAssignment?: boolean;
  disabled?: boolean;
  helperText?: string;
  footer?: ReactNode;
}

export function CrewMemberCard({ crew, onSelect, compact, showAssignment, disabled, helperText, footer }: CrewMemberCardProps) {
  const skillStars = '★'.repeat(crew.skillLevel) + '☆'.repeat(10 - crew.skillLevel);
  const experienceThreshold = getExperienceThresholdForLevel(crew.skillLevel);
  const experiencePercent =
    experienceThreshold === Infinity
      ? 100
      : Math.min(100, Math.round((crew.experience / experienceThreshold) * 100));
  const xpLabel =
    experienceThreshold === Infinity
      ? 'Max level'
      : `${experiencePercent}% to next level`;

  if (compact) {
    return (
      <Card
        className={`transition-colors ${
          disabled || crew.assignedTo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
        }`}
        onClick={() => {
          if (!disabled && !crew.assignedTo) {
            onSelect?.();
          }
        }}
        aria-disabled={disabled || !!crew.assignedTo}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{crew.name}</div>
                <div className="text-xs text-muted-foreground">Lvl {crew.skillLevel}</div>
                <div className="text-[10px] text-muted-foreground">{xpLabel}</div>
                {helperText && (
                  <div className="text-[10px] text-muted-foreground/80 mt-1">{helperText}</div>
                )}
              </div>
            </div>
            <DepartmentBadge department={crew.department} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`${
        disabled ? 'opacity-60 cursor-not-allowed' : onSelect ? 'cursor-pointer hover:border-primary' : ''
      } transition-colors`}
      onClick={() => {
        if (!disabled) {
          onSelect?.();
        }
      }}
      aria-disabled={disabled}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                {crew.name}
              </h4>
              <div className="text-xs text-muted-foreground mt-1">{skillStars}</div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>XP Progress</span>
                  <span>{experienceThreshold === Infinity ? 'MAX' : `${experiencePercent}%`}</span>
                </div>
                <Progress
                  value={experienceThreshold === Infinity ? 100 : experiencePercent}
                  className="h-2"
                />
                {crew.certifications.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    <span className="font-medium text-foreground">Certifications:</span>{' '}
                    {crew.certifications.join(', ')}
                  </div>
                )}
              </div>
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

          <div className="text-xs text-muted-foreground">
            Available {format(crew.availableOn, 'MMM dd, yyyy')}
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

          {helperText && (
            <div className="text-xs text-muted-foreground/80 pt-1 border-t mt-2">
              {helperText}
            </div>
          )}

          {crew.recentMoraleShift && (
            <div
              className={`mt-3 rounded-md border px-2 py-1 text-xs ${
                crew.recentMoraleShift.type === 'positive'
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-destructive/10 text-destructive border-destructive/30'
              }`}
            >
              <div className="font-medium">
                {crew.recentMoraleShift.description}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {crew.recentMoraleShift.delta > 0 ? '+' : ''}
                {crew.recentMoraleShift.delta} morale •{' '}
                {format(crew.recentMoraleShift.date, 'MMM dd')}
              </div>
            </div>
          )}

          {footer}
        </div>
      </CardContent>
    </Card>
  );
}
