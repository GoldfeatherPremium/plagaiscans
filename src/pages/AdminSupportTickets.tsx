import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Ticket, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  User,
  Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminSupportTickets() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Get user profiles
      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const ticketsWithUsers = data.map(ticket => {
        const profile = profiles?.find(p => p.id === ticket.user_id);
        return {
          ...ticket,
          user_email: profile?.email,
          user_name: profile?.full_name,
        };
      });

      setTickets(ticketsWithUsers as SupportTicket[]);
    }
    setLoading(false);
  };

  const updateTicketStatus = async (id: string, status: SupportTicket['status']) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('id', id);

    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, status } : t));
      if (selectedTicket?.id === id) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      toast({ title: 'Updated', description: `Ticket status changed to ${status}` });
    }
  };

  const sendResponse = async () => {
    if (!selectedTicket || !response.trim()) return;

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('support_tickets')
      .update({
        admin_response: response.trim(),
        responded_by: user?.id,
        responded_at: new Date().toISOString(),
        status: 'resolved',
      })
      .eq('id', selectedTicket.id);

    setSending(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sent', description: 'Response sent to user' });
      setSelectedTicket(null);
      setResponse('');
      fetchTickets();
    }
  };

  const getStatusBadge = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open': return <Badge variant="destructive">Open</Badge>;
      case 'in_progress': return <Badge variant="default">In Progress</Badge>;
      case 'resolved': return <Badge variant="secondary" className="bg-secondary text-secondary-foreground">Resolved</Badge>;
      case 'closed': return <Badge variant="outline">Closed</Badge>;
    }
  };

  const getPriorityBadge = (priority: SupportTicket['priority']) => {
    switch (priority) {
      case 'low': return <Badge variant="outline">Low</Badge>;
      case 'normal': return <Badge variant="secondary">Normal</Badge>;
      case 'high': return <Badge variant="default" className="bg-accent text-accent-foreground">High</Badge>;
      case 'urgent': return <Badge variant="destructive">Urgent</Badge>;
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        ticket.subject.toLowerCase().includes(query) ||
        ticket.user_email?.toLowerCase().includes(query) ||
        ticket.user_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Manage customer support requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-xl font-bold">{stats.open}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-xl font-bold">{stats.inProgress}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-xl font-bold">{stats.resolved}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Ticket className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{tickets.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No support tickets</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <h3 className="font-semibold truncate">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.user_name || ticket.user_email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ticket.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              {selectedTicket?.subject}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(v) => updateTicketStatus(selectedTicket.id, v as SupportTicket['status'])}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      {selectedTicket.user_name || 'Customer'} ({selectedTicket.user_email})
                    </div>
                    <CardDescription>
                      {format(new Date(selectedTicket.created_at), 'MMMM dd, yyyy HH:mm')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{selectedTicket.message}</p>
                  </CardContent>
                </Card>

                {selectedTicket.admin_response && (
                  <Card className="border-secondary/50 bg-secondary/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 text-sm text-secondary">
                        <CheckCircle className="h-4 w-4" />
                        Admin Response
                      </div>
                      <CardDescription>
                        {selectedTicket.responded_at && format(new Date(selectedTicket.responded_at), 'MMMM dd, yyyy HH:mm')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                    </CardContent>
                  </Card>
                )}

                {!selectedTicket.admin_response && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your response..."
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={sendResponse} disabled={sending || !response.trim()} className="w-full">
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send Response
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
