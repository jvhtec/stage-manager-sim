import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Finances() {
  const { gameState, updateBalance } = useGame();
  const navigate = useNavigate();

  const { transactions, creditLimit, overdraftDays } = gameState.finances;

  const sortedTransactions = [...transactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const thirtyDaysAgo = new Date(gameState.currentDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lastThirty = transactions.filter(t => t.date >= thirtyDaysAgo);
  const lastThirtyNet = lastThirty.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
    0
  );

  const handleEmergencyLoan = () => {
    updateBalance(5000, {
      description: 'Emergency bridge loan',
      category: 'operations',
    });
    toast.success('Emergency funds secured', {
      description: 'A short-term loan has been added to your balance.',
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
              <h1 className="text-3xl font-bold">Financial Overview</h1>
              <p className="text-muted-foreground">
                Track income, expenses, and credit health
              </p>
            </div>
          </div>
        </div>

        {gameState.isBankrupt && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Bankruptcy Triggered</AlertTitle>
            <AlertDescription>
              Your balance has fallen below the credit limit. Resolve outstanding debts before taking further actions.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <PiggyBank className="h-4 w-4" /> Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${gameState.company.balance.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Credit limit -${Math.abs(creditLimit).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Net (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lastThirtyNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                {lastThirtyNet >= 0 ? '+' : '-'}${Math.abs(lastThirtyNet).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on {lastThirty.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                +${totalIncome.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across all contracts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingDown className="h-4 w-4" /> Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                -${totalExpenses.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Payroll and operations</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Credit Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Days in overdraft</span>
              <Badge variant={overdraftDays > 0 ? 'secondary' : 'outline'}>
                {overdraftDays}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bankruptcy status</span>
              <Badge variant={gameState.isBankrupt ? 'destructive' : 'secondary'}>
                {gameState.isBankrupt ? 'Bankrupt' : 'Solvent'}
              </Badge>
            </div>
            {(gameState.isBankrupt || gameState.company.balance < 0) && (
              <Button className="w-full" variant="outline" onClick={handleEmergencyLoan}>
                Request Emergency Loan (+$5,000)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No financial activity recorded yet.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Date</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-[140px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map(txn => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {format(txn.date, 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {txn.category}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{txn.description}</div>
                          {txn.eventId && (
                            <div className="text-xs text-muted-foreground">
                              Event ID: {txn.eventId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={txn.type === 'income' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                            {txn.type === 'income' ? '+' : '-'}${txn.amount.toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
