import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Clock, CheckCircle, CreditCard, Upload, Download, Wallet, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/StatusBadge';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { PushNotificationBanner } from '@/components/PushNotificationBanner';
import { CreditExpirationCard } from '@/components/CreditExpirationCard';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Shimmer } from '@/components/ui/shimmer';
import { StatCardSkeleton } from '@/components/ui/page-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SEO } from '@/components/SEO';

interface ManualPayment {
  id: string;
  payment_method: string;
  amount_usd: number;
  credits: number;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { role, profile, user, loading: authLoading } = useAuth();
  const { documents, loading: docsLoading, downloadFile } = useDocuments();
  const [pendingPayments, setPendingPayments] = useState<ManualPayment[]>([]);

  const stats = {
    pending: documents.filter((d) => d.status === 'pending').length,
    inProgress: documents.filter((d) => d.status === 'in_progress').length,
    completed: documents.filter((d) => d.status === 'completed').length,
    total: documents.length,
  };

  const recentDocs = documents.slice(0, 5);

  // Fetch pending payments for customers
  useEffect(() => {
    const fetchPendingPayments = async () => {
      if (role !== 'customer' || !user) return;
      
      const { data } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) {
        setPendingPayments(data);
      }
    };
    
    fetchPendingPayments();

    // Real-time subscription for payment status updates
    if (role === 'customer' && user) {
      const channel = supabase
        .channel('payment-status-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'manual_payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Payment update received:', payload);
            if (payload.eventType === 'UPDATE') {
              setPendingPayments(prev => 
                prev.map(p => p.id === payload.new.id ? payload.new as ManualPayment : p)
              );
            } else if (payload.eventType === 'INSERT') {
              setPendingPayments(prev => [payload.new as ManualPayment, ...prev].slice(0, 5));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role, user]);

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Verified</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <>
      <SEO
        title="Dashboard"
        description="Manage your documents, track their status, and download reports from your PlagaiScans dashboard."
        noIndex={true}
      />
      <DashboardLayout>
      <div className="space-y-8">
        {/* Announcements */}
        <AnnouncementBanner />

        {/* Push Notification Prompt for Customers */}
        {role === 'customer' && <PushNotificationBanner />}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === 'customer'
              ? 'Manage your documents and track their status'
              : role === 'staff'
              ? 'View and process assigned documents'
              : 'Overview of platform activity'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${!docsLoading ? 'content-reveal-stagger' : ''}`}>
          {docsLoading ? (
            <>
              {role === 'customer' && <StatCardSkeleton />}
              <StatCardSkeleton />
              <StatCardSkeleton />
              {role !== 'staff' && <StatCardSkeleton />}
            </>
          ) : (
            <>
              {role === 'customer' && (
                <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                        <CreditCard className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Credit Balance</p>
                        <p className="text-2xl font-bold">{profile?.credit_balance || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-accent/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/20">
                      <Clock className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">{stats.pending}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">In Progress</p>
                      <p className="text-2xl font-bold">{stats.inProgress}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {role !== 'staff' && (
                <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-secondary/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                        <CheckCircle className="h-6 w-6 text-secondary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="text-2xl font-bold">{stats.completed}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Pending Payments - Customer Only */}
        {role === 'customer' && pendingPayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#F0B90B]" />
                My Payments
              </CardTitle>
              <CardDescription>Track your recent payment submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingPayments.map((payment, index) => (
                  <div 
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg transition-all duration-300 hover:bg-muted/50 hover:border-primary/20 hover:-translate-x-1"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center transition-transform duration-300 hover:scale-110">
                        <Wallet className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium">{payment.credits} Credits</p>
                        <p className="text-sm text-muted-foreground">
                          ${payment.amount_usd} • {format(new Date(payment.created_at), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                    {getPaymentStatusBadge(payment.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credit Expiration Warning - Customer Only */}
        {role === 'customer' && <CreditExpirationCard />}

        {/* Quick Actions */}
        {role === 'customer' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="group hover:-translate-y-2 hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer overflow-hidden">
              <Link to="/dashboard/upload">
                <CardContent className="p-6 flex items-center gap-4 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/30">
                    <Upload className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div className="relative">
                    <h3 className="font-semibold text-lg">Upload Document</h3>
                    <p className="text-sm text-muted-foreground">
                      Submit a new document for checking
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
            <Card className="group hover:-translate-y-2 hover:shadow-xl hover:border-secondary/50 transition-all duration-300 cursor-pointer overflow-hidden">
              <Link to="/dashboard/credits">
                <CardContent className="p-6 flex items-center gap-4 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="h-14 w-14 rounded-xl gradient-success flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-secondary/30">
                    <CreditCard className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <div className="relative">
                    <h3 className="font-semibold text-lg">Buy Credits</h3>
                    <p className="text-sm text-muted-foreground">
                      Purchase more credits via WhatsApp
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        )}

        {/* Recent Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>
                {role === 'customer' ? 'Your latest uploads' : 'Latest document activity'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={role === 'customer' ? '/dashboard/documents' : '/dashboard/queue'}>
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-6">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No documents yet</p>
                {role === 'customer' && (
                  <Button className="mt-4" asChild>
                    <Link to="/dashboard/upload">Upload Your First Document</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Upload Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Similarity Report</TableHead>
                      <TableHead className="text-center">AI Report</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDocs.map((doc, index) => {
                      const { date, time } = formatDateTime(doc.uploaded_at);
                      const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
                      return (
                        <TableRow key={doc.id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-medium truncate max-w-[200px]" title={doc.file_name}>
                                {doc.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{date}</div>
                              <div className="text-muted-foreground">{time}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={doc.status} />
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.similarity_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(doc.similarity_report_path!, 'reports', `${baseName}_similarity.pdf`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.ai_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(doc.ai_report_path!, 'reports', `${baseName}_ai.pdf`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {doc.error_message ? (
                              <span className="text-sm text-destructive">{doc.error_message}</span>
                            ) : doc.status === 'pending' ? (
                              <span className="text-sm text-muted-foreground">In queue</span>
                            ) : doc.status === 'in_progress' ? (
                              <span className="text-sm text-muted-foreground">Processing...</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </>
  );
}