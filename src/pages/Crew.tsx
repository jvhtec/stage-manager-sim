import { useGame } from '@/contexts/GameContext';
import { CrewMemberCard } from '@/components/CrewMemberCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, DollarSign, Handshake, UserMinus } from 'lucide-react';
import { CrewMember, Department } from '@/types/game';
import { toast } from 'sonner';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { format } from 'date-fns';

export default function Crew() {
  const { gameState, hireCandidate, negotiateCandidateRate, fireCrew } = useGame();

  const audioCrew = gameState.crew.filter(c => c.department === 'audio');
  const lightingCrew = gameState.crew.filter(c => c.department === 'lighting');
  const videoCrew = gameState.crew.filter(c => c.department === 'video');
  const stageCrew = gameState.crew.filter(c => c.department === 'stage');

  const handleHireCandidate = (candidateId: string, name: string) => {
    const result = hireCandidate(candidateId);
    if (result.success) {
      toast.success('Candidate hired!', { description: `${name} has joined your team` });
    } else {
      toast.error('Could not hire', { description: result.reason });
    }
  };

  const handleNegotiate = (candidateId: string) => {
    const result = negotiateCandidateRate(candidateId);
    if (result.success) {
      toast.success('Negotiation succeeded', { description: result.reason });
    } else {
      toast.error('Negotiation failed', { description: result.reason });
    }
  };

  const handleFireCrew = (crewId: string, name: string) => {
    const result = fireCrew(crewId);
    if (result.success) {
      toast.success('Crew member let go', { description: `${name} has left the company` });
    } else {
      toast.error('Could not let them go', { description: result.reason });
    }
  };

  const renderFireButton = (crew: CrewMember) => (
    <Button
      variant="destructive"
      size="sm"
      className="w-full mt-1"
      disabled={!!crew.assignedTo}
      onClick={() => handleFireCrew(crew.id, crew.name)}
    >
      <UserMinus className="mr-2 h-4 w-4" />
      Let go
    </Button>
  );

  const crewHelperText = (crew: CrewMember) => {
    const availableDate = new Date(crew.availableOn);
    if (availableDate > gameState.currentDate) {
      return `Traveling until ${format(availableDate, 'MMM dd')}`;
    }
    if (crew.fatigue >= 85) {
      return 'Needs rest';
    }
    return undefined;
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Crew Management</h1>
          <p className="text-muted-foreground">
            {gameState.crew.length} total crew members
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Handshake className="h-5 w-5" />
              Hiring Market
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              A fresh pool of candidates rotates in every payday. Negotiate once per candidate for
              better terms — pushing too hard can make them walk.
            </p>
          </CardHeader>
          <CardContent>
            {gameState.crewCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates available right now.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gameState.crewCandidates.map(candidate => (
                  <Card key={candidate.id} className="border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{candidate.name}</h4>
                          <div className="text-xs text-muted-foreground">
                            Skill {candidate.skillLevel}/10
                          </div>
                        </div>
                        <DepartmentBadge department={candidate.department} />
                      </div>

                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          ${candidate.askingRate}/hr asking rate
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${candidate.signingBonus} signing bonus
                        </div>
                      </div>

                      {candidate.certifications.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {candidate.certifications.join(', ')}
                        </div>
                      )}

                      {candidate.negotiated && (
                        <Badge variant="outline" className="text-xs">Already negotiated</Badge>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={candidate.negotiated || gameState.isBankrupt}
                          onClick={() => handleNegotiate(candidate.id)}
                        >
                          Negotiate
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={gameState.isBankrupt || gameState.company.balance < candidate.signingBonus}
                          onClick={() => handleHireCandidate(candidate.id, candidate.name)}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Hire
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                    helperText={crewHelperText(crew)}
                    footer={renderFireButton(crew)}
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Check the Hiring Market above for {dept} candidates.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {deptCrew.map(crew => (
                      <CrewMemberCard
                        key={crew.id}
                        crew={crew}
                        showAssignment
                        helperText={crewHelperText(crew)}
                        footer={renderFireButton(crew)}
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
