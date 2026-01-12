import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Clock, CheckCircle, CreditCard, Upload, Download, Wallet, XCircle, BarChart3, ArrowRight } from 'lucide-react';
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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('dashboard');

  // Full Scan Queue Stats (all documents except similarity_only)
  const fullScanStats = {
    pending: documents.filter((d) => d.status === 'pending' && d.scan_type !== 'similarity_only').length,
    inProgress: documents.filter((d) => d.status === 'in_progress' && d.scan_type !== 'similarity_only').length,
    completed: documents.filter((d) => d.status === 'completed' && d.scan_type !== 'similarity_only').length,
  };

  // Similarity Only Queue Stats
  const similarityStats = {
    pending: documents.filter((d) => d.status === 'pending' && d.scan_type === 'similarity_only').length,
    inProgress: documents.filter((d) => d.status === 'in_progress' && d.scan_type === 'similarity_only').length,
    completed: documents.filter((d) => d.status === 'completed' && d.scan_type === 'similarity_only').length,
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
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" /> {t('overview.pending')}</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> {t('overview.verified')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="h-3 w-3 mr-1" /> {t('overview.rejected')}</Badge>;
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
        title={t('overview.title')}
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
            {t('overview.welcome', { name: profile?.full_name?.split(' ')[0] || 'User' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === 'customer'
              ? t('overview.customerSubtitle')
              : role === 'staff'
              ? t('overview.staffSubtitle')
              : t('overview.adminSubtitle')}
          </p>
        </div>

        {/* Full Scan Queue Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('overview.fullScanQueue')}
            </h3>
            {(role === 'staff' || role === 'admin') && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/dashboard/queue">
                  {t('overview.goToQueue')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${!docsLoading ? 'content-reveal-stagger' : ''}`}>
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
                          <p className="text-sm text-muted-foreground">{t('overview.fullCredits')}</p>
                          <p className="text-2xl font-bold">{profile?.credit_balance || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-yellow-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-yellow-500/20">
                        <Clock className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('overview.pending')}</p>
                        <p className="text-2xl font-bold">{fullScanStats.pending}</p>
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
                        <p className="text-sm text-muted-foreground">{t('overview.inProgress')}</p>
                        <p className="text-2xl font-bold">{fullScanStats.inProgress}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {role !== 'staff' && (
                  <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-green-500/30 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-green-500/20">
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('overview.completed')}</p>
                          <p className="text-2xl font-bold">{fullScanStats.completed}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>

        {/* Similarity Only Queue Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              {t('overview.similarityQueue')}
            </h3>
            {(role === 'staff' || role === 'admin') && (
              <Button asChild variant="outline" size="sm" className="gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10">
                <Link to="/dashboard/queue-similarity">
                  {t('overview.goToQueue')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${!docsLoading ? 'content-reveal-stagger' : ''}`}>
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
                  <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/30 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                          <CreditCard className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('overview.similarityCredits')}</p>
                          <p className="text-2xl font-bold">{profile?.similarity_credit_balance || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-yellow-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-yellow-500/20">
                        <Clock className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('overview.pending')}</p>
                        <p className="text-2xl font-bold">{similarityStats.pending}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                        <BarChart3 className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('overview.inProgress')}</p>
                        <p className="text-2xl font-bold">{similarityStats.inProgress}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {role !== 'staff' && (
                  <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-green-500/30 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-green-500/20">
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('overview.completed')}</p>
                          <p className="text-2xl font-bold">{similarityStats.completed}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pending Payments - Customer Only */}
        {role === 'customer' && pendingPayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#F0B90B]" />
                {t('overview.myPayments')}
              </CardTitle>
              <CardDescription>{t('overview.trackPayments')}</CardDescription>
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
                        <p className="font-medium">{payment.credits} {t('overview.credits')}</p>
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
                    <h3 className="font-semibold text-lg">{t('sidebar.uploadFull')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('overview.uploadSubtitle')}
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
                    <h3 className="font-semibold text-lg">{t('sidebar.buyCredits')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('overview.buyCreditsSubtitle')}
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
              <CardTitle>{t('overview.recentDocuments')}</CardTitle>
              <CardDescription>
                {role === 'customer' ? t('overview.yourLatestUploads') : t('overview.latestActivity')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={role === 'customer' ? '/dashboard/documents' : '/dashboard/queue'}>
                {t('overview.viewAll')}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-6">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('overview.noDocuments')}</p>
                {role === 'customer' && (
                  <Button className="mt-4" asChild>
                    <Link to="/dashboard/upload">{t('overview.uploadFirst')}</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>{t('documents.document')}</TableHead>
                      <TableHead>{t('documents.uploadTime')}</TableHead>
                      <TableHead className="text-center">{t('documents.status')}</TableHead>
                      <TableHead className="text-center">{t('documents.similarityReport')}</TableHead>
                      <TableHead className="text-center">{t('documents.aiReport')}</TableHead>
                      <TableHead>{t('documents.remarks')}</TableHead>
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
                            {doc.remarks ? (
                              <span className="text-sm truncate max-w-[150px] block" title={doc.remarks}>
                                {doc.remarks}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
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
