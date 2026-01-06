import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Filter, RefreshCw, Download, Trash2, 
  Edit2, CheckCircle, AlertCircle, Clock, Loader2, X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardLayout } from '@/components/DashboardLayout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface QueueItem {
  id: string;
  original_filename: string;
  normalized_filename: string;
  report_path: string;
  similarity_percentage: number | null;
  queue_status: 'queued' | 'processing' | 'completed' | 'failed';
  needs_review: boolean;
  review_reason: string | null;
  processed_at: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

const AdminSimilarityQueue: React.FC = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<string>('all');
  
  // Edit modal state
  const [editItem, setEditItem] = useState<QueueItem | null>(null);
  const [editPercentage, setEditPercentage] = useState<string>('');
  const [saving, setSaving] = useState(false);
  
  // Delete dialog state
  const [deleteItem, setDeleteItem] = useState<QueueItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('similarity_queue')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('queue_status', statusFilter as 'queued' | 'processing' | 'completed' | 'failed');
      }

      if (reviewFilter === 'needs_review') {
        query = query.eq('needs_review', true);
      } else if (reviewFilter === 'reviewed') {
        query = query.eq('needs_review', false);
      }

      if (searchQuery) {
        query = query.or(`original_filename.ilike.%${searchQuery}%,normalized_filename.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Failed to fetch queue items:', err);
      toast({
        title: 'Error',
        description: 'Failed to load queue items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [statusFilter, reviewFilter]);

  const handleSearch = () => {
    fetchItems();
  };

  const getStatusBadge = (status: QueueItem['queue_status']) => {
    switch (status) {
      case 'queued':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
      case 'processing':
        return <Badge variant="outline" className="animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
  };

  const handleDownload = async (item: QueueItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('similarity-reports')
        .download(item.report_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (item: QueueItem) => {
    setEditItem(item);
    setEditPercentage(item.similarity_percentage?.toString() || '');
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    
    setSaving(true);
    try {
      const percentage = editPercentage ? parseFloat(editPercentage) : null;
      
      const { error } = await supabase
        .from('similarity_queue')
        .update({
          similarity_percentage: percentage,
          needs_review: false,
          review_reason: null,
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Item updated successfully' });
      setEditItem(null);
      fetchItems();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReviewed = async (item: QueueItem) => {
    try {
      const { error } = await supabase
        .from('similarity_queue')
        .update({ needs_review: false })
        .eq('id', item.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Marked as reviewed' });
      fetchItems();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    
    setDeleting(true);
    try {
      // Delete from storage
      await supabase.storage
        .from('similarity-reports')
        .remove([deleteItem.report_path]);

      // Delete from database
      const { error } = await supabase
        .from('similarity_queue')
        .delete()
        .eq('id', deleteItem.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Item deleted successfully' });
      setDeleteItem(null);
      fetchItems();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <SEO
        title="Similarity Queue Management"
        description="Manage similarity report processing queue"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Similarity Queue</h1>
            <p className="text-muted-foreground">
              View and manage similarity report processing queue
            </p>
          </div>
          <Button onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Search by filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} variant="secondary">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-48">
                <Label>Review Status</Label>
                <Select value={reviewFilter} onValueChange={setReviewFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="needs_review">Needs Review</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Table */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No queue items found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Similarity %</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium truncate">{item.original_filename}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Normalized: {item.normalized_filename}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.queue_status)}</TableCell>
                        <TableCell>
                          {item.similarity_percentage !== null ? (
                            <span className="font-mono">{item.similarity_percentage}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.needs_review ? (
                            <div>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                                Needs Review
                              </Badge>
                              {item.review_reason && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-32 truncate">
                                  {item.review_reason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {format(new Date(item.uploaded_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(item)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(item)}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {item.needs_review && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMarkReviewed(item)}
                                title="Mark Reviewed"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteItem(item)}
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* Edit Modal */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Queue Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Filename</Label>
              <p className="text-sm text-muted-foreground">{editItem?.original_filename}</p>
            </div>
            <div>
              <Label htmlFor="percentage">Similarity Percentage</Label>
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                value={editPercentage}
                onChange={(e) => setEditPercentage(e.target.value)}
                placeholder="Enter percentage (0-100)"
              />
            </div>
            {editItem?.review_reason && (
              <div>
                <Label>Review Reason</Label>
                <p className="text-sm text-muted-foreground">{editItem.review_reason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save & Mark Reviewed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Queue Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the report "{deleteItem?.original_filename}" from the queue and storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminSimilarityQueue;
