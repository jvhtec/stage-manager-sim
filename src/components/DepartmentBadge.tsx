import { Badge } from '@/components/ui/badge';
import { Department } from '@/types/game';
import { Volume2, Lightbulb, Video, HardHat } from 'lucide-react';

interface DepartmentBadgeProps {
  department: Department;
  className?: string;
}

const departmentConfig = {
  audio: { icon: Volume2, color: 'bg-audio text-audio-foreground', label: 'Audio' },
  lighting: { icon: Lightbulb, color: 'bg-lighting text-lighting-foreground', label: 'Lighting' },
  video: { icon: Video, color: 'bg-video text-video-foreground', label: 'Video' },
  stage: { icon: HardHat, color: 'bg-stage text-stage-foreground', label: 'Stage' },
};

export function DepartmentBadge({ department, className }: DepartmentBadgeProps) {
  const config = departmentConfig[department];
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.color} ${className || ''}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
