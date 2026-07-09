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
  AlertTriangle,
  Banknote,
  PiggyBank,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { MAX_OVERDRAFT_DAYS } from '@/lib/finance';
import { GAME_OVER_BANKRUPT_STREAK_DAYS, calculateMaxLoanAmount } from '@/lib/economy';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

export default function Finances() {
  const { gameState, takeLoan, repayLoan } = useGame();
  const summary = useFinancialSummary();

  const { creditLimit, overdraftDays, loanBalance } = gameState.finances;
  const maxLoan = calculateMaxLoanAmount(gameState.company.reputation);
  const availableCredit = Math.max(0, maxLoan - loanBalance);
  const daysUntilGameOver = GAME_OVER_BANKRUPT_STREAK_DAYS - gameState.bankruptStreak;
  const {
    sortedTransactions,
    totals,
    thirtyDay,
    categorySummary,
    alerts,
    balanceTrend,
  } = summary;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const chartData = balanceTrend.map(point => ({
    date: format(point.date, 'MMM dd'),
    balance: point.balance,
  }));

  const positiveDays = balanceTrend.filter(point => point.net >= 0).length;
  const negativeDays = balanceTrend.length - positiveDays;
  const peakBalance = balanceTrend.length
    ? Math.max(...balanceTrend.map(point => point.balance))
    : gameState.company.balance;
  const lowestBalance = balanceTrend.length
    ? Math.min(...balanceTrend.map(point => point.balance))
    : gameState.company.balance;

  const handleTakeLoan = (amount: number) => {
    const result = takeLoan(amount);
    if (!result.success) {
      toast.error('Unable to secure loan', { description: result.reason });
      return;
    }
    toast.success(`Loan secured: +${formatCurrency(amount)}`, {
      description: 'Interest accrues daily until repaid — see Credit Health below.',
    });
  };

  const handleRepayLoan = (amount: number) => {
    const result = repayLoan(amount);
    if (!result.success) {
      toast.error('Unable to repay loan', { description: result.reason });
      return;
    }
    toast.success(`Repaid ${formatCurrency(amount)}`);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financial Overview</h1>
          <p className="text-muted-foreground">
            Track income, expenses, and credit health
          </p>
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

        <div className="grid gap-4 lg:grid-cols-3">
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
              {gameState.isBankrupt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Days until the company folds</span>
                  <Badge variant="destructive">{Math.max(0, daysUntilGameOver)}</Badge>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Bankruptcy triggers if balance falls below the credit limit or stays negative for {MAX_OVERDRAFT_DAYS} consecutive days.
                {' '}Finishing shows already booked still pays out while bankrupt — or take a loan below.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Banknote className="h-4 w-4" /> Bank Loan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Outstanding balance</span>
                <span className={`font-semibold ${loanBalance > 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(loanBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available credit</span>
                <span className="font-semibold">{formatCurrency(availableCredit)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                1% daily interest accrues on any outstanding balance. Credit limit scales with reputation.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[1000, 2500].map(amount => (
                  <Button
                    key={`take-${amount}`}
                    variant="outline"
                    size="sm"
                    disabled={amount > availableCredit}
                    onClick={() => handleTakeLoan(amount)}
                  >
                    Borrow {formatCurrency(amount)}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[500, 2000].map(amount => (
                  <Button
                    key={`repay-${amount}`}
                    variant="outline"
                    size="sm"
                    disabled={loanBalance <= 0 || gameState.company.balance <= 0}
                    onClick={() => handleRepayLoan(Math.min(amount, loanBalance))}
                  >
                    Repay {formatCurrency(Math.min(amount, loanBalance || amount))}
                  </Button>
                ))}
              </div>
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
            <CardTitle>30-Day Balance Trend</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track how cash on hand evolves as income and expenses land each day.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Complete a few contracts to build up balance history.
              </p>
            ) : (
              <>
                <ChartContainer
                  config={{
                    balance: {
                      label: 'Ending Balance',
                      theme: {
                        light: 'hsl(var(--primary))',
                        dark: 'hsl(var(--primary))',
                      },
                    },
                  }}
                  className="h-[260px]"
                >
                  <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} interval={3} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={value => formatCurrency(value as number)}
                      width={80}
                    />
                    <ChartTooltip
                      cursor={{ strokeDasharray: '4 4', stroke: 'var(--border)' }}
                      content={
                        <ChartTooltipContent
                          formatter={value => [formatCurrency(value as number), 'Ending Balance']}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--color-balance)"
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>

                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Peak Balance</div>
                    <div className="font-semibold">{formatCurrency(peakBalance)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Lowest Balance</div>
                    <div className="font-semibold">{formatCurrency(lowestBalance)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Winning Days</div>
                    <div className="font-semibold">
                      {positiveDays} positive / {negativeDays} negative
                    </div>
                  </div>
                </div>
              </>
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
