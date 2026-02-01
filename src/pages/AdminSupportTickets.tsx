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
  Search,
  ShieldCheck
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

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ticket_type: string;
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
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
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
      // Get user profiles for non-guest tickets
      const userIds = [...new Set(data.filter(t => t.user_id !== '00000000-0000-0000-0000-000000000000').map(t => t.user_id))];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        profiles = profileData || [];
      }

      const ticketsWithUsers = data.map(ticket => {
        // For guest tickets (contact form), parse email from message
        if (ticket.user_id === '00000000-0000-0000-0000-000000000000') {
          const emailMatch = ticket.message.match(/Email:\s*([^\n]+)/);
          const nameMatch = ticket.message.match(/From:\s*([^\n]+)/);
          return {
            ...ticket,
            user_email: emailMatch ? emailMatch[1].trim() : 'Guest',
            user_name: nameMatch ? nameMatch[1].trim() : 'Guest User',
          };
        }
        
        const profile = profiles.find(p => p.id === ticket.user_id);
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

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as TicketMessage[]);
    }
    setLoadingMessages(false);
  };

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewMessage('');
    await fetchMessages(ticket.id);
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

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: user?.id || '',
        message: newMessage.trim(),
        is_admin: true,
      });

    // Update ticket status to in_progress if it was open
    if (selectedTicket.status === 'open') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', selectedTicket.id);
      
      setSelectedTicket({ ...selectedTicket, status: 'in_progress' });
      setTickets(tickets.map(t => t.id === selectedTicket.id ? { ...t, status: 'in_progress' } : t));
    }

    setSending(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewMessage('');
      await fetchMessages(selectedTicket.id);
    }
  };

  const getStatusBadge = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open': return <Badge variant="destructive">Open</Badge>;
      case 'in_progress': return <Badge variant="default">In Progress</Badge>;
      case 'resolved': return <Badge variant="secondary" className="bg-green-500/10 text-green-600">Resolved</Badge>;
      case 'closed': return <Badge variant="outline">Closed</Badge>;
    }
  };

  const getPriorityBadge = (priority: SupportTicket['priority']) => {
    switch (priority) {
      case 'low': return <Badge variant="outline">Low</Badge>;
      case 'normal': return <Badge variant="secondary">Normal</Badge>;
      case 'high': return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">High</Badge>;
      case 'urgent': return <Badge variant="destructive">Urgent</Badge>;
    }
  };

  const getTicketTypeLabel = (type: string) => {
    switch (type) {
      case 'contact': return 'Contact Form';
      case 'custom_pricing': return 'Custom Pricing';
      case 'support': return 'Support';
      default: return type || 'General';
    }
  };

  const getTicketTypeBadge = (type: string) => {
    switch (type) {
      case 'custom_pricing': 
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Custom Pricing</Badge>;
      case 'contact': 
        return <Badge variant="outline">Contact Form</Badge>;
      default: 
        return <Badge variant="secondary">Support</Badge>;
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterType !== 'all' && (ticket.ticket_type || 'contact') !== filterType) return false;
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
    customPricing: tickets.filter(t => t.ticket_type === 'custom_pricing').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Manage customer support requests and conversations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-xl font-bold">{stats.resolved}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custom Pricing</p>
                <p className="text-xl font-bold">{stats.customPricing}</p>
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="contact">Contact Form</SelectItem>
              <SelectItem value="custom_pricing">Custom Pricing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tickets List */}
          <div className="lg:col-span-1 space-y-3 max-h-[700px] overflow-y-auto">
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
              filteredTickets.map((ticket) => (
                <Card 
                  key={ticket.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedTicket?.id === ticket.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleSelectTicket(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(ticket.created_at), 'MMM dd')}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1">{ticket.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {ticket.user_name || ticket.user_email || 'Guest'}
                      </div>
                      {getTicketTypeBadge(ticket.ticket_type)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Conversation View */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <Card className="h-[700px] flex flex-col">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-1">{selectedTicket.subject}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {selectedTicket.user_name || selectedTicket.user_email || 'Guest'}
                        </span>
                        <span>•</span>
                        <span>{format(new Date(selectedTicket.created_at), 'MMM dd, yyyy HH:mm')}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTicketTypeBadge(selectedTicket.ticket_type)}
                      <Select
                        value={selectedTicket.status}
                        onValueChange={(v) => updateTicketStatus(selectedTicket.id, v as SupportTicket['status'])}
                      >
                        <SelectTrigger className="w-[130px] h-8">
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
                  </div>
                </CardHeader>
                
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Original ticket message */}
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">
                            {selectedTicket.user_name || 'Customer'} • {selectedTicket.user_email}
                          </div>
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1 block">
                            {format(new Date(selectedTicket.created_at), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                      </div>

                      {/* Thread messages */}
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.is_admin ? 'flex-row-reverse' : ''}`}>
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.is_admin ? 'bg-green-500/10' : 'bg-primary/10'
                          }`}>
                            {msg.is_admin ? (
                              <ShieldCheck className="h-4 w-4 text-green-600" />
                            ) : (
                              <User className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className={`flex-1 ${msg.is_admin ? 'text-right' : ''}`}>
                            <div className={`rounded-lg p-3 inline-block max-w-[80%] ${
                              msg.is_admin 
                                ? 'bg-green-500/10 text-left' 
                                : 'bg-muted text-left'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {msg.is_admin ? 'You • ' : ''}
                              {format(new Date(msg.created_at), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Legacy admin_response display */}
                      {selectedTicket.admin_response && messages.length === 0 && (
                        <div className="flex gap-3 flex-row-reverse">
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1 text-right">
                            <div className="bg-green-500/10 rounded-lg p-3 inline-block max-w-[80%] text-left">
                              <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              Admin • {selectedTicket.responded_at && format(new Date(selectedTicket.responded_at), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Reply Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="min-h-[60px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={sendMessage} 
                      disabled={sending || !newMessage.trim()}
                      className="self-end"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="h-[700px] flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Select a ticket to view the conversation</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}