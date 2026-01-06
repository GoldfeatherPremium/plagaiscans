import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Trash2, FileText, Users, Filter, Download, Calendar, User, Link } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

interface DeletedDocument {
  id: string;
  original_document_id: string;
  user_id: string | null;
  magic_link_id: string | null;
  file_name: string;
  file_path: string;
  scan_type: string;
  similarity_percentage: number | null;
  ai_percentage: number | null;
  similarity_report_path: string | null;
  ai_report_path: string | null;
  remarks: string | null;
  uploaded_at: string | null;
  completed_at: string | null;
  deleted_at: string;
  deleted_by_type: string;
  customer_email: string | null;
  customer_name: string | null;
  magic_link_token?: string | null;
}

export default function AdminDeletedDocuments() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<DeletedDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchDeletedLogs();
  }, []);

  const fetchDeletedLogs = async () => {
    setLoading(true);
    
    // Fetch deleted documents with magic link tokens
    const { data, error } = await supabase
      .from('deleted_documents_log')
      .select(`
        *,
        magic_upload_links:magic_link_id (
          token
        )
      `)
      .order('deleted_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching deleted documents:', error);
      setLogs([]);
    } else {
      // Transform data to include magic_link_token
      const transformedData = (data || []).map((log: any) => ({
        ...log,
        magic_link_token: log.magic_upload_links?.token || null,
      }));
      setLogs(transformedData);
    }
    
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    if (filterType === 'customer') {
      filtered = filtered.filter(log => log.user_id && !log.magic_link_id);
    } else if (filterType === 'guest') {
      filtered = filtered.filter(log => log.magic_link_id);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.file_name.toLowerCase().includes(query) ||
        log.customer_email?.toLowerCase().includes(query) ||
        log.customer_name?.toLowerCase().includes(query) ||
        log.original_document_id.toLowerCase().includes(query) ||
        log.magic_link_token?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [logs, searchQuery, filterType]);

  const exportLogs = () => {
    const csv = [
      ['Deleted At', 'File Name', 'User Type', 'Magic Link Token', 'Customer Name', 'Customer Email', 'Scan Type', 'Similarity %', 'AI %', 'Uploaded At', 'Completed At'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.deleted_at), 'yyyy-MM-dd HH:mm:ss'),
        `"${log.file_name.replace(/"/g, '""')}"`,
        log.magic_link_id ? 'Guest' : 'Customer',
        log.magic_link_token || '',
        log.customer_name || '',
        log.customer_email || '',
        log.scan_type,
        log.similarity_percentage ?? '',
        log.ai_percentage ?? '',
        log.uploaded_at ? format(new Date(log.uploaded_at), 'yyyy-MM-dd HH:mm:ss') : '',
        log.completed_at ? format(new Date(log.completed_at), 'yyyy-MM-dd HH:mm:ss') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deleted-documents-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const customerCount = logs.filter(l => l.user_id && !l.magic_link_id).length;
  const guestCount = logs.filter(l => l.magic_link_id).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Deleted Documents</h1>
            <p className="text-muted-foreground mt-1">Track all documents deleted by customers</p>
          </div>
          <Button onClick={exportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by file name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Deletions</SelectItem>
              <SelectItem value="customer">Customers Only</SelectItem>
              <SelectItem value="guest">Guests Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deleted</p>
                <p className="text-xl font-bold">{logs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">By Customers</p>
                <p className="text-xl font-bold">{customerCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Link className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">By Guests (Magic Links)</p>
                <p className="text-xl font-bold">{guestCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No deleted documents found</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-[180px]">Deleted At</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Scan Type</TableHead>
                      <TableHead className="text-center">Results</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            {format(new Date(log.deleted_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.deleted_at), 'HH:mm:ss')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate max-w-[200px]" title={log.file_name}>
                              {log.file_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.magic_link_id ? 'secondary' : 'default'}>
                            {log.magic_link_id ? 'Guest' : 'Customer'}
                          </Badge>
                          {log.magic_link_token && (
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              Link: {log.magic_link_token.slice(0, 8)}...
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.customer_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{log.customer_email || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.scan_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 text-xs">
                            {log.similarity_percentage !== null && (
                              <span className="text-blue-600 dark:text-blue-400">
                                S: {log.similarity_percentage}%
                              </span>
                            )}
                            {log.ai_percentage !== null && (
                              <span className="text-purple-600 dark:text-purple-400">
                                AI: {log.ai_percentage}%
                              </span>
                            )}
                            {log.similarity_percentage === null && log.ai_percentage === null && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.uploaded_at 
                            ? format(new Date(log.uploaded_at), 'MMM dd, HH:mm')
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} deleted documents
        </p>
      </div>
    </DashboardLayout>
  );
}
