import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  FileText, 
  Users, 
  CreditCard, 
  FileCheck, 
  Loader2,
  Calendar,
  Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  generate: (startDate: string, endDate: string) => Promise<string>;
}

export default function AdminReports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateUsersReport = async (start: string, end: string): Promise<string> => {
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59')
      .order('created_at', { ascending: false });

    const { data: roles } = await supabase.from('user_roles').select('*');

    if (!users) return '';

    const csv = [
      ['ID', 'Name', 'Email', 'Phone', 'Role', 'Credit Balance', 'Created At'].join(','),
      ...users.map(user => {
        const role = roles?.find(r => r.user_id === user.id)?.role || 'customer';
        return [
          user.id,
          `"${(user.full_name || '').replace(/"/g, '""')}"`,
          user.email,
          user.phone || '',
          role,
          user.credit_balance,
          format(new Date(user.created_at), 'yyyy-MM-dd HH:mm:ss'),
        ].join(',');
      })
    ].join('\n');

    return csv;
  };

  const generateDocumentsReport = async (start: string, end: string): Promise<string> => {
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .gte('uploaded_at', start)
      .lte('uploaded_at', end + 'T23:59:59')
      .order('uploaded_at', { ascending: false });

    if (!docs) return '';

    // Get user emails
    const userIds = [...new Set(docs.map(d => d.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length > 0 
      ? await supabase.from('profiles').select('id, email').in('id', userIds as string[])
      : { data: [] };

    const csv = [
      ['ID', 'File Name', 'Status', 'User Email', 'Similarity %', 'AI %', 'Uploaded At', 'Completed At', 'Processing Time (min)'].join(','),
      ...docs.map(doc => {
        const userEmail = profiles?.find(p => p.id === doc.user_id)?.email || 'N/A';
        let processingTime = '';
        if (doc.completed_at && doc.uploaded_at) {
          const mins = Math.round((new Date(doc.completed_at).getTime() - new Date(doc.uploaded_at).getTime()) / 60000);
          processingTime = mins.toString();
        }
        return [
          doc.id,
          `"${doc.file_name.replace(/"/g, '""')}"`,
          doc.status,
          userEmail,
          doc.similarity_percentage ?? '',
          doc.ai_percentage ?? '',
          format(new Date(doc.uploaded_at), 'yyyy-MM-dd HH:mm:ss'),
          doc.completed_at ? format(new Date(doc.completed_at), 'yyyy-MM-dd HH:mm:ss') : '',
          processingTime,
        ].join(',');
      })
    ].join('\n');

    return csv;
  };

  const generateTransactionsReport = async (start: string, end: string): Promise<string> => {
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59')
      .order('created_at', { ascending: false });

    if (!transactions) return '';

    // Get user emails
    const userIds = [...new Set(transactions.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const csv = [
      ['ID', 'Date', 'User Name', 'User Email', 'Type', 'Amount', 'Before', 'After', 'Description'].join(','),
      ...transactions.map(tx => {
        const profile = profiles?.find(p => p.id === tx.user_id);
        return [
          tx.id,
          format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
          `"${(profile?.full_name || '').replace(/"/g, '""')}"`,
          profile?.email || '',
          tx.transaction_type,
          tx.amount,
          tx.balance_before,
          tx.balance_after,
          `"${(tx.description || '').replace(/"/g, '""')}"`,
        ].join(',');
      })
    ].join('\n');

    return csv;
  };

  const generateStaffPerformanceReport = async (start: string, end: string): Promise<string> => {
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end + 'T23:59:59')
      .eq('action', 'Changed status to completed');

    if (!logs) return '';

    // Get staff profiles
    const staffIds = [...new Set(logs.map(l => l.staff_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', staffIds);

    // Count by staff
    const staffCounts: Record<string, number> = {};
    logs.forEach(log => {
      staffCounts[log.staff_id] = (staffCounts[log.staff_id] || 0) + 1;
    });

    const csv = [
      ['Staff ID', 'Name', 'Email', 'Documents Completed', 'Period'].join(','),
      ...Object.entries(staffCounts).map(([staffId, count]) => {
        const profile = profiles?.find(p => p.id === staffId);
        return [
          staffId,
          `"${(profile?.full_name || '').replace(/"/g, '""')}"`,
          profile?.email || '',
          count,
          `${start} to ${end}`,
        ].join(',');
      })
    ].join('\n');

    return csv;
  };

  const reports: ReportConfig[] = [
    {
      id: 'users',
      title: 'Users Report',
      description: 'Export all user accounts with their details and credit balances',
      icon: <Users className="h-6 w-6" />,
      generate: generateUsersReport,
    },
    {
      id: 'documents',
      title: 'Documents Report',
      description: 'Export all documents with status, results, and processing times',
      icon: <FileText className="h-6 w-6" />,
      generate: generateDocumentsReport,
    },
    {
      id: 'transactions',
      title: 'Credit Transactions',
      description: 'Export all credit transactions for financial records',
      icon: <CreditCard className="h-6 w-6" />,
      generate: generateTransactionsReport,
    },
    {
      id: 'staff',
      title: 'Staff Performance',
      description: 'Export staff productivity metrics and completed documents',
      icon: <FileCheck className="h-6 w-6" />,
      generate: generateStaffPerformanceReport,
    },
  ];

  const handleGenerate = async (report: ReportConfig) => {
    setLoading(report.id);
    try {
      const csv = await report.generate(startDate, endDate);
      if (csv) {
        downloadCSV(csv, `${report.id}-report-${startDate}-to-${endDate}.csv`);
        toast({ title: 'Success', description: `${report.title} downloaded` });
      } else {
        toast({ title: 'No data', description: 'No records found for this period', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
    }
    setLoading(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Reports & Export</h1>
          <p className="text-muted-foreground mt-1">Generate and download data reports</p>
        </div>

        {/* Date Range */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Range
            </CardTitle>
            <CardDescription>Select the date range for your reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => (
            <Card key={report.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {report.icon}
                  </div>
                </div>
                <CardTitle className="mt-4">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleGenerate(report)}
                  disabled={loading === report.id}
                  className="w-full"
                >
                  {loading === report.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download CSV
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Format</p>
                <p className="text-muted-foreground">CSV (Comma Separated Values)</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Selected Period</p>
                <p className="text-muted-foreground">{startDate} to {endDate}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Compatible With</p>
                <p className="text-muted-foreground">Excel, Google Sheets, Numbers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
