import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Tag, TrendingUp, Users, DollarSign, BarChart3, Calendar, 
  ArrowUp, ArrowDown, Loader2, Percent
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface PromoCodeStats {
  id: string;
  code: string;
  credits_bonus: number;
  discount_percentage: number | null;
  current_uses: number;
  max_uses: number | null;
  is_active: boolean;
  created_at: string;
  valid_until: string | null;
  total_credits_given: number;
  revenue_impact: number;
}

interface UsageData {
  date: string;
  uses: number;
  credits: number;
}

export default function AdminPromoAnalytics() {
  const [loading, setLoading] = useState(true);
  const [promoStats, setPromoStats] = useState<PromoCodeStats[]>([]);
  const [usageByDay, setUsageByDay] = useState<UsageData[]>([]);
  const [summary, setSummary] = useState({
    totalCodes: 0,
    activeCodes: 0,
    totalUses: 0,
    totalCreditsGiven: 0,
    estimatedRevenueSaved: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all promo codes
      const { data: promoCodes } = await supabase
        .from('promo_codes')
        .select('*')
        .order('current_uses', { ascending: false });

      // Fetch usage data
      const { data: usageData } = await supabase
        .from('promo_code_uses')
        .select('*, promo_codes(code, credits_bonus, discount_percentage)')
        .order('used_at', { ascending: false });

      if (promoCodes) {
        const statsWithCredits = promoCodes.map(promo => {
          const promoUses = usageData?.filter(u => u.promo_code_id === promo.id) || [];
          const totalCreditsGiven = promoUses.reduce((sum, u) => sum + (u.credits_given || promo.credits_bonus), 0);
          // Estimate revenue impact: credits_bonus * $1 (assuming $1/credit) or discount_percentage of avg order
          const revenueImpact = totalCreditsGiven * 1 + (promo.discount_percentage || 0) * promo.current_uses * 0.5;
          
          return {
            ...promo,
            total_credits_given: totalCreditsGiven,
            revenue_impact: revenueImpact,
          };
        });

        setPromoStats(statsWithCredits);

        // Calculate summary
        const totalUses = promoCodes.reduce((sum, p) => sum + p.current_uses, 0);
        const totalCreditsGiven = statsWithCredits.reduce((sum, p) => sum + p.total_credits_given, 0);
        const estimatedRevenueSaved = statsWithCredits.reduce((sum, p) => sum + p.revenue_impact, 0);

        setSummary({
          totalCodes: promoCodes.length,
          activeCodes: promoCodes.filter(p => p.is_active).length,
          totalUses,
          totalCreditsGiven,
          estimatedRevenueSaved,
        });
      }

      // Process usage by day for chart
      if (usageData) {
        const byDay: Record<string, { uses: number; credits: number }> = {};
        usageData.forEach(usage => {
          const day = format(new Date(usage.used_at), 'MMM dd');
          if (!byDay[day]) {
            byDay[day] = { uses: 0, credits: 0 };
          }
          byDay[day].uses++;
          byDay[day].credits += usage.credits_given || 0;
        });

        const chartData = Object.entries(byDay).slice(0, 14).reverse().map(([date, data]) => ({
          date,
          uses: data.uses,
          credits: data.credits,
        }));

        setUsageByDay(chartData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#10b981', '#f59e0b'];

  const pieData = promoStats.slice(0, 5).map(p => ({
    name: p.code,
    value: p.current_uses,
  }));

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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Promo Code Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track usage, revenue impact, and performance of promotional codes
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Tag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Codes</p>
                  <p className="text-2xl font-bold">{summary.totalCodes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Codes</p>
                  <p className="text-2xl font-bold">{summary.activeCodes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Uses</p>
                  <p className="text-2xl font-bold">{summary.totalUses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Percent className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credits Given</p>
                  <p className="text-2xl font-bold">{summary.totalCreditsGiven}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Impact</p>
                  <p className="text-2xl font-bold">~${summary.estimatedRevenueSaved.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Usage Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Over Time
              </CardTitle>
              <CardDescription>Daily promo code redemptions</CardDescription>
            </CardHeader>
            <CardContent>
              {usageByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={usageByDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                    />
                    <Bar dataKey="uses" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No usage data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Codes Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Most Popular Codes
              </CardTitle>
              <CardDescription>Top 5 promo codes by usage</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 && pieData.some(p => p.value > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No usage data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Promo Codes Performance</CardTitle>
            <CardDescription>Detailed breakdown of each promotional code</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-center">Bonus Credits</TableHead>
                  <TableHead className="text-center">Discount %</TableHead>
                  <TableHead className="text-center">Uses</TableHead>
                  <TableHead className="text-center">Total Credits Given</TableHead>
                  <TableHead className="text-center">Revenue Impact</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoStats.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <span className="font-mono font-bold">{promo.code}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {promo.credits_bonus > 0 ? (
                        <Badge variant="secondary">+{promo.credits_bonus}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {promo.discount_percentage ? (
                        <Badge variant="outline" className="text-green-600">{promo.discount_percentage}%</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-medium">{promo.current_uses}</span>
                        {promo.max_uses && (
                          <span className="text-muted-foreground">/{promo.max_uses}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {promo.total_credits_given}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-red-600 font-medium">
                        ~${promo.revenue_impact.toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {promo.is_active ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {promo.valid_until ? (
                        <span className="text-sm">
                          {format(new Date(promo.valid_until), 'MMM dd, yyyy')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No expiry</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
