import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  SkipForward,
  RefreshCw,
  Search,
  Eye,
  FileText,
  User,
  RotateCcw,
  Loader2
} from 'lucide-react';

interface EmailLog {
  id: string;
  email_type: string;
  recipient_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  document_id: string | null;
  status: string;
  provider_response: any;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  metadata: any;
}

export default function AdminEmailDeliveryLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactional_email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50000);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('email_type', typeFilter);
      }

      if (searchTerm) {
        query = query.or(`recipient_email.ilike.%${searchTerm}%,recipient_name.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);

      // Calculate stats
      const allLogs = data || [];
      setStats({
        total: allLogs.length,
        sent: allLogs.filter(l => l.status === 'sent').length,
        failed: allLogs.filter(l => l.status === 'failed').length,
        skipped: allLogs.filter(l => l.status === 'skipped').length,
        pending: allLogs.filter(l => l.status === 'pending').length,
      });
    } catch (error) {
      console.error('Error fetching email logs:', error);
      toast.error('Failed to fetch email logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, typeFilter, searchTerm]);

  const retryEmail = async (log: EmailLog) => {
    setRetryingIds(prev => new Set(prev).add(log.id));
    
    try {
      let functionName = '';
      let payload: any = {};

      switch (log.email_type) {
        case 'document_completion':
          functionName = 'send-completion-email';
          payload = {
            documentId: log.document_id,
            userId: log.recipient_id,
            fileName: log.metadata?.fileName || 'Document',
            retryLogId: log.id,
          };
          break;
        case 'welcome':
          functionName = 'send-welcome-email';
          payload = {
            userId: log.recipient_id,
            email: log.recipient_email,
            fullName: log.recipient_name,
            retryLogId: log.id,
          };
          break;
        case 'password_reset':
          functionName = 'send-password-reset';
          payload = {
            email: log.recipient_email,
            retryLogId: log.id,
          };
          break;
        default:
          throw new Error(`Retry not supported for email type: ${log.email_type}`);
      }

      const { error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      if (error) throw error;

      toast.success('Email retry initiated');
      
      // Refresh logs after a short delay
      setTimeout(() => {
        fetchLogs();
      }, 2000);
    } catch (error: any) {
      console.error('Error retrying email:', error);
      toast.error(`Failed to retry email: ${error.message}`);
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(log.id);
        return next;
      });
    }
  };

  const getFailedRetryableEmails = () => {
    return logs.filter(log => 
      log.status === 'failed' && 
      ['document_completion', 'welcome', 'password_reset'].includes(log.email_type)
    );
  };

  const retryAllFailed = async () => {
    const failedEmails = getFailedRetryableEmails();
    
    if (failedEmails.length === 0) {
      toast.info('No failed emails to retry');
      return;
    }

    setBulkRetrying(true);
    let successCount = 0;
    let failCount = 0;

    for (const log of failedEmails) {
      try {
        let functionName = '';
        let payload: any = {};

        switch (log.email_type) {
          case 'document_completion':
            functionName = 'send-completion-email';
            payload = { documentId: log.document_id, userId: log.recipient_id, fileName: log.metadata?.fileName || 'Document', retryLogId: log.id };
            break;
          case 'welcome':
            functionName = 'send-welcome-email';
            payload = { userId: log.recipient_id, email: log.recipient_email, fullName: log.recipient_name, retryLogId: log.id };
            break;
          case 'password_reset':
            functionName = 'send-password-reset';
            payload = { email: log.recipient_email, retryLogId: log.id };
            break;
        }

        const { error } = await supabase.functions.invoke(functionName, { body: payload });
        
        if (error) {
          failCount++;
        } else {
          successCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {
        failCount++;
      }
    }

    setBulkRetrying(false);
    toast.success(`Bulk retry complete: ${successCount} succeeded, ${failCount} failed`);
    fetchLogs();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="secondary">
            <SkipForward className="h-3 w-3 mr-1" />
            Skipped
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmailTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      document_completion: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      welcome: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      password_reset: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      payment_verified: 'bg-green-500/10 text-green-600 border-green-500/20',
      pending_document_notification: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      admin_notification: 'bg-red-500/10 text-red-600 border-red-500/20',
    };

    const typeLabels: Record<string, string> = {
      document_completion: 'Completion',
      welcome: 'Welcome',
      password_reset: 'Password Reset',
      payment_verified: 'Payment',
      pending_document_notification: 'Pending Alert',
      admin_notification: 'Admin Alert',
    };

    return (
      <Badge className={typeColors[type] || 'bg-gray-500/10 text-gray-600'}>
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const getFromAddress = (log: EmailLog): string => {
    if (log.metadata?.from_email) {
      return log.metadata.from_email;
    }
    // Default from address based on type
    return 'support@plagaiscans.com';
  };

  const canRetry = (log: EmailLog) => {
    return log.status === 'failed' && ['document_completion', 'welcome', 'password_reset'].includes(log.email_type);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Email Delivery Logs</h1>
            <p className="text-muted-foreground">Track all transactional email deliveries</p>
          </div>
          <div className="flex gap-2">
            {getFailedRetryableEmails().length > 0 && (
              <Button 
                onClick={retryAllFailed} 
                variant="default" 
                disabled={bulkRetrying}
              >
                {bulkRetrying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry All Failed ({getFailedRetryableEmails().length})
                  </>
                )}
              </Button>
            )}
            <Button onClick={fetchLogs} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.skipped}</p>
                </div>
                <SkipForward className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}%
                  </p>
                </div>
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, name, or subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Email Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="document_completion">Completion</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="password_reset">Password Reset</SelectItem>
                  <SelectItem value="payment_verified">Payment</SelectItem>
                  <SelectItem value="pending_document_notification">Pending Alert</SelectItem>
                  <SelectItem value="admin_notification">Admin Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Email Logs</CardTitle>
            <CardDescription>
              Showing {logs.length} email records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No email logs found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{getEmailTypeBadge(log.email_type)}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{getFromAddress(log)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{log.recipient_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{log.recipient_email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[200px] block">{log.subject}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.sent_at 
                              ? format(new Date(log.sent_at), 'MMM d, HH:mm')
                              : format(new Date(log.created_at), 'MMM d, HH:mm')
                            }
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canRetry(log) && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => retryEmail(log)}
                                disabled={retryingIds.has(log.id)}
                                title="Retry sending email"
                              >
                                {retryingIds.has(log.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Email Details</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh]">
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                                        <p>{log.email_type}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                                        {getStatusBadge(log.status)}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">From Address</p>
                                        <p>{getFromAddress(log)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Recipient</p>
                                        <p>{log.recipient_email}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                                        <p>{log.recipient_name || 'N/A'}</p>
                                      </div>
                                      <div className="col-span-2">
                                        <p className="text-sm font-medium text-muted-foreground">Subject</p>
                                        <p>{log.subject}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Created</p>
                                        <p>{format(new Date(log.created_at), 'PPpp')}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground">Sent</p>
                                        <p>{log.sent_at ? format(new Date(log.sent_at), 'PPpp') : 'N/A'}</p>
                                      </div>
                                    </div>

                                    {log.metadata && (
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Metadata</p>
                                        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                                          {JSON.stringify(log.metadata, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {log.error_message && (
                                      <div>
                                        <p className="text-sm font-medium text-red-600 mb-2">Error Message</p>
                                        <p className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                                          {log.error_message}
                                        </p>
                                      </div>
                                    )}

                                    {log.provider_response && (
                                      <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Provider Response</p>
                                        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                                          {JSON.stringify(log.provider_response, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {log.document_id && (
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">Document ID: {log.document_id}</span>
                                      </div>
                                    )}

                                    {canRetry(log) && (
                                      <div className="pt-4 border-t">
                                        <Button 
                                          onClick={() => retryEmail(log)}
                                          disabled={retryingIds.has(log.id)}
                                        >
                                          {retryingIds.has(log.id) ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Retrying...
                                            </>
                                          ) : (
                                            <>
                                              <RotateCcw className="h-4 w-4 mr-2" />
                                              Retry Email
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </div>
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
    </DashboardLayout>
  );
}
