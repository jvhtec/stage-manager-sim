import { useGame } from '@/contexts/GameContext';
import { CrewMemberCard } from '@/components/CrewMemberCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserPlus } from 'lucide-react';
import { generateCrewMember } from '@/lib/gameData';
import { Department } from '@/types/game';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from 'react';
import { DepartmentBadge } from '@/components/DepartmentBadge';

export default function Crew() {
  const { gameState, hireCrew, updateBalance } = useGame();
  const navigate = useNavigate();
  const [isHireDialogOpen, setIsHireDialogOpen] = useState(false);
  
  const audioCrew = gameState.crew.filter(c => c.department === 'audio');
  const lightingCrew = gameState.crew.filter(c => c.department === 'lighting');
  const videoCrew = gameState.crew.filter(c => c.department === 'video');
  const stageCrew = gameState.crew.filter(c => c.department === 'stage');
  
  const handleHire = (department: Department) => {
    const skillLevel = 3 + Math.floor(Math.random() * 5); // 3-7
    const newCrew = generateCrewMember(department, skillLevel);
    const hiringCost = 500; // Base hiring cost
    
    if (gameState.company.balance < hiringCost) {
      toast.error('Insufficient funds', {
        description: `You need $${hiringCost} to hire crew`,
      });
      return;
    }
    
    hireCrew(newCrew);
    updateBalance(-hiringCost);
    setIsHireDialogOpen(false);
    toast.success('Crew hired!', {
      description: `${newCrew.name} has joined your team`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Crew Management</h1>
              <p className="text-muted-foreground">
                {gameState.crew.length} total crew members
              </p>
            </div>
          </div>
          
          <Dialog open={isHireDialogOpen} onOpenChange={setIsHireDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Hire Crew
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hire New Crew</DialogTitle>
                <DialogDescription>
                  Select a department to hire a new crew member. Hiring cost: $500
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                {(['audio', 'lighting', 'video', 'stage'] as Department[]).map(dept => (
                  <Button
                    key={dept}
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => handleHire(dept)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <DepartmentBadge department={dept} />
                      <span className="text-sm text-muted-foreground">
                        Random skill level 3-7
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">
              All ({gameState.crew.length})
            </TabsTrigger>
            <TabsTrigger value="audio">
              Audio ({audioCrew.length})
            </TabsTrigger>
            <TabsTrigger value="lighting">
              Lighting ({lightingCrew.length})
            </TabsTrigger>
            <TabsTrigger value="video">
              Video ({videoCrew.length})
            </TabsTrigger>
            <TabsTrigger value="stage">
              Stage ({stageCrew.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-6">
            {gameState.crew.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No crew members yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gameState.crew.map(crew => (
                  <CrewMemberCard
                    key={crew.id}
                    crew={crew}
                    showAssignment
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {(['audio', 'lighting', 'video', 'stage'] as Department[]).map(dept => {
            const deptCrew = gameState.crew.filter(c => c.department === dept);
            return (
              <TabsContent key={dept} value={dept} className="space-y-4 mt-6">
                {deptCrew.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No {dept} crew members</p>
                      <Button className="mt-4" onClick={() => setIsHireDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Hire {dept} crew
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {deptCrew.map(crew => (
                      <CrewMemberCard
                        key={crew.id}
                        crew={crew}
                        showAssignment
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
