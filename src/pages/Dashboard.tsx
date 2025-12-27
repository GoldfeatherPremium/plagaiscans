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

interface ManualPayment {
  id: string;
  payment_method: string;
  amount_usd: number;
  credits: number;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { role, profile, user } = useAuth();
  const { documents, downloadFile } = useDocuments();
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
    <DashboardLayout>
      <div className="space-y-8">
        {/* Announcements */}
        <AnnouncementBanner />

        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-display font-bold gradient-text">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {role === 'customer'
              ? 'Manage your documents and track their status'
              : role === 'staff'
              ? 'View and process assigned documents'
              : 'Overview of platform activity'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {role === 'customer' && (
            <Card className="group hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-500 overflow-hidden animate-fade-in stagger-1">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
                    <CreditCard className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Credit Balance</p>
                    <p className="text-3xl font-bold gradient-text">{profile?.credit_balance || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="group hover:shadow-lg hover:shadow-accent/10 hover:-translate-y-1 transition-all duration-500 overflow-hidden animate-fade-in stagger-2">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center shadow-lg shadow-accent/30 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-500 overflow-hidden animate-fade-in stagger-3">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">In Progress</p>
                  <p className="text-3xl font-bold">{stats.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {role !== 'staff' && (
            <Card className="group hover:shadow-lg hover:shadow-secondary/10 hover:-translate-y-1 transition-all duration-500 overflow-hidden animate-fade-in stagger-4">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-secondary to-secondary-glow flex items-center justify-center shadow-lg shadow-secondary/30 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Completed</p>
                    <p className="text-3xl font-bold">{stats.completed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                {pendingPayments.map((payment) => (
                  <div 
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-[#F0B90B]" />
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

        {/* Quick Actions */}
        {role === 'customer' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fade-in stagger-5">
            <Card className="group hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden border-2 border-transparent hover:border-primary/30">
              <Link to="/dashboard/upload">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 flex items-center gap-5 relative">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/40 transition-all duration-300">
                    <Upload className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl group-hover:text-primary transition-colors">Upload Document</h3>
                    <p className="text-muted-foreground">
                      Submit a new document for checking
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
            <Card className="group hover:shadow-xl hover:shadow-secondary/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden border-2 border-transparent hover:border-secondary/30">
              <Link to="/dashboard/credits">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-6 flex items-center gap-5 relative">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-secondary to-secondary-glow flex items-center justify-center shadow-lg shadow-secondary/30 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-secondary/40 transition-all duration-300">
                    <CreditCard className="h-8 w-8 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl group-hover:text-secondary transition-colors">Buy Credits</h3>
                    <p className="text-muted-foreground">
                      Purchase more credits via WhatsApp
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        )}

        {/* Recent Documents */}
        <Card className="animate-fade-in stagger-6 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Recent Documents</CardTitle>
              <CardDescription>
                {role === 'customer' ? 'Your latest uploads' : 'Latest document activity'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-colors" asChild>
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
  );
}