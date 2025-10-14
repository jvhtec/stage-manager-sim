import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EquipmentItem } from '@/types/game';
import { DepartmentBadge } from './DepartmentBadge';
import { Calendar, Package, Wrench } from 'lucide-react';
import { format } from 'date-fns';

interface EquipmentCardProps {
  equipment: EquipmentItem;
  onSelect?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  helperText?: string;
  actionLabel?: string;
  removeLabel?: string;
}

export function EquipmentCard({
  equipment,
  onSelect,
  onRemove,
  disabled,
  helperText,
  actionLabel = 'Assign',
  removeLabel = 'Remove',
}: EquipmentCardProps) {
  const isRental = Boolean(equipment.rentalInfo);
  const maintenanceDue = format(equipment.maintenanceDue, 'MMM dd');
  const statusColor =
    equipment.status === 'available'
      ? 'bg-success/10 text-success'
      : equipment.status === 'assigned'
        ? 'bg-warning/10 text-warning'
        : 'bg-muted text-muted-foreground';

  return (
    <Card
      className={`transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed' : onSelect ? 'hover:border-primary cursor-pointer' : ''
      }`}
      onClick={() => {
        if (!disabled && onSelect) {
          onSelect();
        }
      }}
      aria-disabled={disabled}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{equipment.name}</h4>
              <Badge className={statusColor}>{equipment.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Package className="h-3 w-3" />
              <span>{isRental ? 'Rental' : 'Owned'} • {equipment.type.replace('-', ' ')}</span>
            </div>
          </div>
          <DepartmentBadge department={equipment.department} />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Condition</span>
            <span>{equipment.condition}%</span>
          </div>
          <Progress value={equipment.condition} className="h-2" />
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Wrench className="h-3 w-3" />
          <span>
            Service due {maintenanceDue}
            {equipment.maintenanceCompleteOn && equipment.status === 'maintenance'
              ? ` • Ready ${format(equipment.maintenanceCompleteOn, 'MMM dd')}`
              : ''}
          </span>
        </div>

        {equipment.rentalInfo && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>Return {format(equipment.rentalInfo.returnDate, 'MMM dd')}</span>
          </div>
        )}

        {helperText && (
          <div className="text-xs text-muted-foreground/80 border-t pt-2">{helperText}</div>
        )}

        {(onSelect || onRemove) && (
          <div className="flex gap-2 pt-2">
            {onSelect && (
              <Button
                size="sm"
                className="flex-1"
                disabled={disabled}
                onClick={event => {
                  event.stopPropagation();
                  onSelect();
                }}
              >
                {actionLabel}
              </Button>
            )}
            {onRemove && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={event => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                {removeLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
