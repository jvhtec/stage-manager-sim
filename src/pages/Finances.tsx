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
import {
  ArrowLeft,
  AlertTriangle,
  Banknote,
  PiggyBank,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { MAX_OVERDRAFT_DAYS } from '@/lib/finance';

export default function Finances() {
  const { gameState, updateBalance } = useGame();
  const navigate = useNavigate();
  const summary = useFinancialSummary();

  const { creditLimit, overdraftDays } = gameState.finances;
  const {
    sortedTransactions,
    totals,
    thirtyDay,
    categorySummary,
    alerts,
  } = summary;

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

        {alerts.map(alert => (
          <Alert key={alert.key} variant={alert.variant}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ))}

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
              <div className={`text-2xl font-bold ${thirtyDay.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                {thirtyDay.net >= 0 ? '+' : '-'}${Math.abs(thirtyDay.net).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on {thirtyDay.transactions.length} transactions
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
                +${totals.income.toLocaleString()}
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
                -${totals.expenses.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Payroll and operations</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
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
              <div className="text-xs text-muted-foreground">
                Bankruptcy triggers if balance falls below the credit limit or stays negative for {MAX_OVERDRAFT_DAYS} consecutive days.
              </div>
              {(gameState.isBankrupt || gameState.company.balance < 0) && (
                <Button className="w-full" variant="outline" onClick={handleEmergencyLoan}>
                  Request Emergency Loan (+$5,000)
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Banknote className="h-4 w-4" /> Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {categorySummary.length === 0 ? (
                <p className="text-muted-foreground">No categorized spending yet.</p>
              ) : (
                categorySummary.map(category => (
                  <div key={category.category} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium capitalize">{category.category}</div>
                      <div className="text-xs text-muted-foreground">
                        {category.count} transaction{category.count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${category.net >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {category.net >= 0 ? '+' : '-'}${Math.abs(category.net).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        +${category.income.toLocaleString()} / -${category.expenses.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

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
