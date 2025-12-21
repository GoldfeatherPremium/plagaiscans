import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Activity, 
  Database, 
  HardDrive, 
  Clock, 
  Users, 
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Zap,
  Server
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface SystemStats {
  totalUsers: number;
  totalDocuments: number;
  pendingDocuments: number;
  inProgressDocuments: number;
  completedDocuments: number;
  totalCreditsInSystem: number;
  activeStaff: number;
  magicLinksActive: number;
  storageUsed: {
    documents: number;
    reports: number;
    magicUploads: number;
  };
  recentErrors: number;
  avgProcessingTime: number;
}

export default function AdminSystemHealth() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalDocuments: 0,
    pendingDocuments: 0,
    inProgressDocuments: 0,
    completedDocuments: 0,
    totalCreditsInSystem: 0,
    activeStaff: 0,
    magicLinksActive: 0,
    storageUsed: { documents: 0, reports: 0, magicUploads: 0 },
    recentErrors: 0,
    avgProcessingTime: 0,
  });

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    setLoading(true);

    // Fetch user count
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch documents
    const { data: docs } = await supabase.from('documents').select('*');
    const allDocs = docs || [];

    // Fetch total credits in system
    const { data: profiles } = await supabase.from('profiles').select('credit_balance');
    const totalCredits = profiles?.reduce((sum, p) => sum + (p.credit_balance || 0), 0) || 0;

    // Fetch active staff count
    const { count: staffCount } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'staff');

    // Fetch active magic links
    const { count: magicCount } = await supabase
      .from('magic_upload_links')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Calculate average processing time for completed documents
    const completedDocs = allDocs.filter(d => d.status === 'completed' && d.completed_at && d.uploaded_at);
    let avgTime = 0;
    if (completedDocs.length > 0) {
      const totalTime = completedDocs.reduce((sum, d) => {
        const uploadTime = new Date(d.uploaded_at).getTime();
        const completeTime = new Date(d.completed_at!).getTime();
        return sum + (completeTime - uploadTime);
      }, 0);
      avgTime = Math.round(totalTime / completedDocs.length / 1000 / 60); // in minutes
    }

    // Count documents with errors
    const errorDocs = allDocs.filter(d => d.error_message).length;

    setStats({
      totalUsers: userCount || 0,
      totalDocuments: allDocs.length,
      pendingDocuments: allDocs.filter(d => d.status === 'pending').length,
      inProgressDocuments: allDocs.filter(d => d.status === 'in_progress').length,
      completedDocuments: allDocs.filter(d => d.status === 'completed').length,
      totalCreditsInSystem: totalCredits,
      activeStaff: staffCount || 0,
      magicLinksActive: magicCount || 0,
      storageUsed: { documents: 0, reports: 0, magicUploads: 0 },
      recentErrors: errorDocs,
      avgProcessingTime: avgTime,
    });

    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSystemStats();
    setRefreshing(false);
    toast({ title: 'Refreshed', description: 'System stats updated' });
  };

  const getHealthStatus = () => {
    if (stats.pendingDocuments > 50) return { status: 'warning', label: 'High Load' };
    if (stats.recentErrors > 10) return { status: 'error', label: 'Issues Detected' };
    return { status: 'healthy', label: 'All Systems Operational' };
  };

  const healthStatus = getHealthStatus();

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">System Health</h1>
            <p className="text-muted-foreground mt-1">Monitor platform status and performance</p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Overall Status */}
        <Card className={`border-2 ${
          healthStatus.status === 'healthy' ? 'border-secondary/50 bg-secondary/5' :
          healthStatus.status === 'warning' ? 'border-accent/50 bg-accent/5' :
          'border-destructive/50 bg-destructive/5'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {healthStatus.status === 'healthy' ? (
                <CheckCircle2 className="h-12 w-12 text-secondary" />
              ) : healthStatus.status === 'warning' ? (
                <AlertTriangle className="h-12 w-12 text-accent" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-destructive" />
              )}
              <div>
                <h2 className="text-2xl font-bold">{healthStatus.label}</h2>
                <p className="text-muted-foreground">
                  Last checked: {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-bold">{stats.totalUsers}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Staff</p>
                  <p className="text-3xl font-bold">{stats.activeStaff}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Server className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Credits in System</p>
                  <p className="text-3xl font-bold">{stats.totalCreditsInSystem.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Processing</p>
                  <p className="text-3xl font-bold">{stats.avgProcessingTime}m</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Document Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Pipeline
            </CardTitle>
            <CardDescription>Current document processing status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{stats.totalDocuments}</p>
                <p className="text-sm text-muted-foreground">Total Documents</p>
              </div>
              <div className="text-center p-4 bg-accent/10 rounded-lg">
                <p className="text-3xl font-bold text-accent">{stats.pendingDocuments}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <p className="text-3xl font-bold text-primary">{stats.inProgressDocuments}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-4 bg-secondary/10 rounded-lg">
                <p className="text-3xl font-bold text-secondary">{stats.completedDocuments}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing Pipeline</span>
                <span>{stats.totalDocuments > 0 ? Math.round((stats.completedDocuments / stats.totalDocuments) * 100) : 0}% completed</span>
              </div>
              <Progress 
                value={stats.totalDocuments > 0 ? (stats.completedDocuments / stats.totalDocuments) * 100 : 0} 
                className="h-3"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Active Magic Links</span>
                <Badge variant="secondary">{stats.magicLinksActive}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Documents with Errors</span>
                <Badge variant={stats.recentErrors > 0 ? 'destructive' : 'secondary'}>
                  {stats.recentErrors}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Queue Backlog</span>
                <Badge variant={stats.pendingDocuments > 20 ? 'destructive' : 'secondary'}>
                  {stats.pendingDocuments} pending
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Completion Rate</span>
                <Badge variant="default">
                  {stats.totalDocuments > 0 ? Math.round((stats.completedDocuments / stats.totalDocuments) * 100) : 0}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Storage Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Documents Bucket</span>
                  <span className="text-muted-foreground">{stats.totalDocuments} files</span>
                </div>
                <Progress value={30} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Reports Bucket</span>
                  <span className="text-muted-foreground">{stats.completedDocuments * 2} files</span>
                </div>
                <Progress value={20} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Magic Uploads</span>
                  <span className="text-muted-foreground">Active links: {stats.magicLinksActive}</span>
                </div>
                <Progress value={10} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
