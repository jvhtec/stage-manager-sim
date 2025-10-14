import { useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';

export function useReputationSummary() {
  const { gameState } = useGame();
  const { reputationHistory, competitors, company } = gameState;

  return useMemo(() => {
    const sortedHistory = [...reputationHistory].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const recentHistory = sortedHistory.slice(-30);
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];

    const playerDelta = first && last ? Number((last.playerReputation - first.playerReputation).toFixed(1)) : 0;
    const competitorDelta =
      first && last ? Number((last.competitorAverage - first.competitorAverage).toFixed(1)) : 0;

    const sortedCompetitors = [...competitors].sort((a, b) => b.reputation - a.reputation);
    const leader = sortedCompetitors[0];
    const trailing = sortedCompetitors.length > 1 ? sortedCompetitors[sortedCompetitors.length - 1] : undefined;

    const history = recentHistory.map(snapshot => ({
      date: snapshot.date,
      player: Number(snapshot.playerReputation.toFixed(1)),
      competitors: Number(snapshot.competitorAverage.toFixed(1)),
    }));

    const average = last?.competitorAverage ?? (leader ? leader.reputation : company.reputation);
    const gapToLeader = leader ? Number((leader.reputation - company.reputation).toFixed(1)) : 0;

    return {
      history,
      latest: last,
      playerDelta,
      competitorDelta,
      leader,
      trailing,
      average: Number(average.toFixed(1)),
      playerReputation: company.reputation,
      gapToLeader,
    };
  }, [reputationHistory, competitors, company.reputation]);
}
