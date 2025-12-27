import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, Mail, User, CreditCard, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SEO } from '@/components/SEO';

interface RefundRequest {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  admin_response: string | null;
  responded_at: string | null;
}

export default function AdminRefundRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [response, setResponse] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch refund requests (tickets with "Refund Request" in subject)
  const { data: refundRequests, isLoading, refetch } = useQuery({
    queryKey: ['admin-refund-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .ilike('subject', '%refund%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RefundRequest[];
    },
  });

  // Respond to refund request
  const respondMutation = useMutation({
    mutationFn: async ({ id, response, status }: { id: string; response: string; status: string }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          admin_response: response,
          status,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] });
      toast({ title: 'Response sent successfully' });
      setDialogOpen(false);
      setSelectedRequest(null);
      setResponse('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRespond = (request: RefundRequest) => {
    setSelectedRequest(request);
    setResponse(request.admin_response || '');
    setDialogOpen(true);
  };

  const handleSubmitResponse = (approved: boolean) => {
    if (!selectedRequest) return;
    respondMutation.mutate({
      id: selectedRequest.id,
      response: response || (approved ? 'Refund approved and processed.' : 'Refund request declined.'),
      status: approved ? 'resolved' : 'closed',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'closed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" /> Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const parseMessage = (message: string) => {
    const lines = message.split('\n');
    const parsed: Record<string, string> = {};
    let currentKey = '';
    
    lines.forEach(line => {
      if (line.startsWith('Name:')) {
        parsed.name = line.replace('Name:', '').trim();
      } else if (line.startsWith('Email:')) {
        parsed.email = line.replace('Email:', '').trim();
      } else if (line.startsWith('Transaction ID:')) {
        parsed.transactionId = line.replace('Transaction ID:', '').trim();
      } else if (line.startsWith('Reason:')) {
        currentKey = 'reason';
        parsed.reason = '';
      } else if (currentKey === 'reason') {
        parsed.reason = (parsed.reason ? parsed.reason + ' ' : '') + line.trim();
      }
    });

    return parsed;
  };

  const pendingCount = refundRequests?.filter(r => r.status === 'open').length || 0;
  const approvedCount = refundRequests?.filter(r => r.status === 'resolved').length || 0;
  const declinedCount = refundRequests?.filter(r => r.status === 'closed').length || 0;

  return (
    <>
      <SEO title="Refund Requests" noIndex={true} />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold">Refund Requests</h1>
              <p className="text-muted-foreground mt-1">
                Manage customer refund requests separately from general support tickets
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{approvedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Declined</p>
                  <p className="text-2xl font-bold">{declinedCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Refund Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Refund Requests</CardTitle>
              <CardDescription>
                {refundRequests?.length || 0} total requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : refundRequests?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No refund requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundRequests?.map((request) => {
                        const parsed = parseMessage(request.message);
                        return (
                          <TableRow key={request.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(request.created_at), 'MMM dd, yyyy')}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(request.created_at), 'HH:mm')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{parsed.name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">{parsed.email || '-'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {parsed.transactionId || 'Not provided'}
                              </code>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="truncate text-sm" title={parsed.reason}>
                                {parsed.reason || '-'}
                              </p>
                            </TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={request.status === 'open' ? 'default' : 'outline'}
                                onClick={() => handleRespond(request)}
                              >
                                {request.status === 'open' ? 'Respond' : 'View'}
                              </Button>
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

        {/* Response Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Refund Request Details</DialogTitle>
              <DialogDescription>
                Review the request and respond to the customer
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  {(() => {
                    const parsed = parseMessage(selectedRequest.message);
                    return (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{parsed.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{parsed.email || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>Transaction: {parsed.transactionId || 'Not provided'}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm mt-2 pt-2 border-t">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span>{parsed.reason || 'No reason provided'}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Admin Response
                  </label>
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Enter your response to the customer..."
                    rows={4}
                    disabled={selectedRequest.status !== 'open'}
                  />
                </div>

                {selectedRequest.admin_response && selectedRequest.status !== 'open' && (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Previous Response:</p>
                    <p className="bg-muted p-3 rounded">{selectedRequest.admin_response}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              {selectedRequest?.status === 'open' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => handleSubmitResponse(false)}
                    disabled={respondMutation.isPending}
                  >
                    {respondMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Decline
                  </Button>
                  <Button
                    onClick={() => handleSubmitResponse(true)}
                    disabled={respondMutation.isPending}
                  >
                    {respondMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Approve Refund
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}
