import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Calendar,
  Users,
  Coins
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface DailyRevenue {
  date: string;
  credits: number;
  transactions: number;
}

interface MonthlyStats {
  month: string;
  creditsAdded: number;
  creditsUsed: number;
  netCredits: number;
}

interface TopCustomer {
  id: string;
  name: string;
  email: string;
  totalCreditsAdded: number;
  totalCreditsUsed: number;
  currentBalance: number;
}

export default function AdminRevenue() {
  const [loading, setLoading] = useState(true);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [totals, setTotals] = useState({
    totalCreditsAdded: 0,
    totalCreditsUsed: 0,
    totalTransactions: 0,
    avgCreditsPerUser: 0,
    thisMonthCredits: 0,
    lastMonthCredits: 0,
  });

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    setLoading(true);

    // Fetch all credit transactions
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!transactions) {
      setLoading(false);
      return;
    }

    // Calculate totals
    let totalAdded = 0;
    let totalUsed = 0;
    transactions.forEach(tx => {
      if (tx.transaction_type === 'add') {
        totalAdded += tx.amount;
      } else {
        totalUsed += Math.abs(tx.amount);
      }
    });

    // Get user count for average
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Calculate this month vs last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthTx = transactions.filter(tx => 
      new Date(tx.created_at) >= thisMonthStart && tx.transaction_type === 'add'
    );
    const lastMonthTx = transactions.filter(tx => {
      const date = new Date(tx.created_at);
      return date >= lastMonthStart && date <= lastMonthEnd && tx.transaction_type === 'add';
    });

    const thisMonthCredits = thisMonthTx.reduce((sum, tx) => sum + tx.amount, 0);
    const lastMonthCredits = lastMonthTx.reduce((sum, tx) => sum + tx.amount, 0);

    setTotals({
      totalCreditsAdded: totalAdded,
      totalCreditsUsed: totalUsed,
      totalTransactions: transactions.length,
      avgCreditsPerUser: userCount ? Math.round(totalAdded / userCount) : 0,
      thisMonthCredits,
      lastMonthCredits,
    });

    // Calculate daily revenue (last 14 days)
    const dailyData: Record<string, { credits: number; transactions: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { credits: 0, transactions: 0 };
    }

    transactions.forEach(tx => {
      const dateStr = tx.created_at.split('T')[0];
      if (dailyData[dateStr] && tx.transaction_type === 'add') {
        dailyData[dateStr].credits += tx.amount;
        dailyData[dateStr].transactions += 1;
      }
    });

    setDailyRevenue(
      Object.entries(dailyData).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...data,
      }))
    );

    // Calculate monthly stats (last 6 months)
    const monthlyData: Record<string, { added: number; used: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = { added: 0, used: 0 };
    }

    transactions.forEach(tx => {
      const monthKey = tx.created_at.substring(0, 7);
      if (monthlyData[monthKey]) {
        if (tx.transaction_type === 'add') {
          monthlyData[monthKey].added += tx.amount;
        } else {
          monthlyData[monthKey].used += Math.abs(tx.amount);
        }
      }
    });

    setMonthlyStats(
      Object.entries(monthlyData).map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        creditsAdded: data.added,
        creditsUsed: data.used,
        netCredits: data.added - data.used,
      }))
    );

    // Get top customers
    const userCredits: Record<string, { added: number; used: number }> = {};
    transactions.forEach(tx => {
      if (!userCredits[tx.user_id]) {
        userCredits[tx.user_id] = { added: 0, used: 0 };
      }
      if (tx.transaction_type === 'add') {
        userCredits[tx.user_id].added += tx.amount;
      } else {
        userCredits[tx.user_id].used += Math.abs(tx.amount);
      }
    });

    const topUserIds = Object.entries(userCredits)
      .sort((a, b) => b[1].added - a[1].added)
      .slice(0, 10)
      .map(([id]) => id);

    if (topUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, credit_balance')
        .in('id', topUserIds);

      if (profiles) {
        const topCustomerData: TopCustomer[] = topUserIds.map(id => {
          const profile = profiles.find(p => p.id === id);
          const credits = userCredits[id];
          return {
            id,
            name: profile?.full_name || 'Unknown',
            email: profile?.email || '',
            totalCreditsAdded: credits.added,
            totalCreditsUsed: credits.used,
            currentBalance: profile?.credit_balance || 0,
          };
        });
        setTopCustomers(topCustomerData);
      }
    }

    setLoading(false);
  };

  const growthPercentage = totals.lastMonthCredits > 0
    ? Math.round(((totals.thisMonthCredits - totals.lastMonthCredits) / totals.lastMonthCredits) * 100)
    : totals.thisMonthCredits > 0 ? 100 : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Revenue & Finance</h1>
          <p className="text-muted-foreground mt-1">Track credit sales and financial metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Credits Sold</p>
                  <p className="text-3xl font-bold">{totals.totalCreditsAdded.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Credits Used</p>
                  <p className="text-3xl font-bold">{totals.totalCreditsUsed.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-3xl font-bold">{totals.thisMonthCredits.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {growthPercentage >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-secondary" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm ${growthPercentage >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {growthPercentage >= 0 ? '+' : ''}{growthPercentage}%
                    </span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg per User</p>
                  <p className="text-3xl font-bold">{totals.avgCreditsPerUser}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Credit Sales</CardTitle>
              <CardDescription>Credits sold in the last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="credits" 
                      stroke="hsl(160, 70%, 45%)" 
                      fill="hsl(160, 70%, 45%)" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Overview</CardTitle>
              <CardDescription>Credits added vs used by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="creditsAdded" name="Added" fill="hsl(160, 70%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="creditsUsed" name="Used" fill="hsl(220, 90%, 56%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Customers
            </CardTitle>
            <CardDescription>Customers with highest credit purchases</CardDescription>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No customer data yet
              </div>
            ) : (
              <div className="space-y-4">
                {topCustomers.map((customer, index) => (
                  <div key={customer.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{customer.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-secondary">+{customer.totalCreditsAdded}</p>
                      <p className="text-xs text-muted-foreground">credits added</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{customer.totalCreditsUsed}</p>
                      <p className="text-xs text-muted-foreground">used</p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      Balance: {customer.currentBalance}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
