import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FileText, 
  TrendingUp, 
  Clock, 
  Calendar,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(142 76% 36%)'];

export default function CustomerDocumentAnalytics() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-analytics', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get all user's documents
      const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (!documents) return null;

      // Calculate stats
      const totalDocuments = documents.length;
      const completedDocuments = documents.filter(d => d.status === 'completed').length;
      const pendingDocuments = documents.filter(d => d.status === 'pending').length;
      const inProgressDocuments = documents.filter(d => d.status === 'in_progress').length;

      // Calculate average processing time
      let avgProcessingTime = 0;
      const completedWithTime = documents.filter(d => d.status === 'completed' && d.completed_at);
      if (completedWithTime.length > 0) {
        const totalMinutes = completedWithTime.reduce((sum, doc) => {
          const uploaded = new Date(doc.uploaded_at).getTime();
          const completed = new Date(doc.completed_at!).getTime();
          return sum + (completed - uploaded) / (1000 * 60);
        }, 0);
        avgProcessingTime = Math.round(totalMinutes / completedWithTime.length);
      }

      // Monthly uploads (last 6 months)
      const monthlyData: { month: string; uploads: number; completed: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subDays(new Date(), i * 30);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        
        const uploads = documents.filter(d => {
          const uploadDate = new Date(d.uploaded_at);
          return uploadDate >= monthStart && uploadDate <= monthEnd;
        }).length;

        const completed = documents.filter(d => {
          if (!d.completed_at) return false;
          const completedDate = new Date(d.completed_at);
          return completedDate >= monthStart && completedDate <= monthEnd;
        }).length;

        monthlyData.push({
          month: format(monthStart, 'MMM'),
          uploads,
          completed
        });
      }

      // Weekly uploads (last 4 weeks)
      const weeklyData: { week: string; count: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = subDays(new Date(), (i + 1) * 7);
        const weekEnd = subDays(new Date(), i * 7);
        
        const count = documents.filter(d => {
          const uploadDate = new Date(d.uploaded_at);
          return uploadDate >= weekStart && uploadDate <= weekEnd;
        }).length;

        weeklyData.push({
          week: `Week ${4 - i}`,
          count
        });
      }

      // Status distribution for pie chart
      const statusData = [
        { name: 'Completed', value: completedDocuments },
        { name: 'Pending', value: pendingDocuments },
        { name: 'In Progress', value: inProgressDocuments }
      ].filter(d => d.value > 0);

      // Average scores
      const docsWithScores = documents.filter(d => d.similarity_percentage !== null || d.ai_percentage !== null);
      const avgSimilarity = docsWithScores.length > 0 
        ? Math.round(docsWithScores.reduce((sum, d) => sum + (d.similarity_percentage || 0), 0) / docsWithScores.length)
        : null;
      const avgAI = docsWithScores.length > 0
        ? Math.round(docsWithScores.reduce((sum, d) => sum + (d.ai_percentage || 0), 0) / docsWithScores.length)
        : null;

      return {
        totalDocuments,
        completedDocuments,
        pendingDocuments,
        avgProcessingTime,
        monthlyData,
        weeklyData,
        statusData,
        avgSimilarity,
        avgAI
      };
    },
    enabled: !!user
  });

  const formatTime = (minutes: number) => {
    if (minutes === 0) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Document Analytics</h1>
          <p className="text-muted-foreground">Insights into your document history</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.totalDocuments || 0}</div>
              <p className="text-xs text-muted-foreground">All time uploads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.completedDocuments || 0}</div>
              <p className="text-xs text-muted-foreground">Successfully processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(data?.avgProcessingTime || 0)}</div>
              <p className="text-xs text-muted-foreground">Time to completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Calendar className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.pendingDocuments || 0}</div>
              <p className="text-xs text-muted-foreground">In queue</p>
            </CardContent>
          </Card>
        </div>

        {/* Average Scores */}
        {(data?.avgSimilarity !== null || data?.avgAI !== null) && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Similarity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {data?.avgSimilarity !== null ? `${data.avgSimilarity}%` : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg AI Detection Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-secondary">
                  {data?.avgAI !== null ? `${data.avgAI}%` : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="uploads" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3}
                      name="Uploads"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      stroke="hsl(var(--secondary))" 
                      fill="hsl(var(--secondary))" 
                      fillOpacity={0.3}
                      name="Completed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {data?.statusData && data.statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.statusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
