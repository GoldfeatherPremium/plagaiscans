import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Ticket, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Plus,
  User,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
}

export default function MySupportTickets() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // New ticket form
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [user?.id]);

  const fetchTickets = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as SupportTicket[]);
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
    await fetchMessages(ticket.id);
  };

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim() || !user?.id) return;

    setSending(true);
    const { error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        message: newMessage.trim(),
        is_admin: false,
      });

    // Reopen ticket if it was resolved/closed
    if (selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') {
      await supabase
        .from('support_tickets')
        .update({ status: 'open' })
        .eq('id', selectedTicket.id);
    }

    setSending(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewMessage('');
      await fetchMessages(selectedTicket.id);
      fetchTickets();
    }
  };

  const createTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim() || !user?.id) return;

    setCreatingTicket(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: newTicketSubject.trim(),
        message: newTicketMessage.trim(),
        ticket_type: 'support',
        priority: 'normal',
        status: 'open',
      })
      .select()
      .single();

    setCreatingTicket(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Your ticket has been submitted' });
      setNewTicketSubject('');
      setNewTicketMessage('');
      setShowNewTicket(false);
      fetchTickets();
      if (data) {
        handleSelectTicket(data as SupportTicket);
      }
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

  const getTicketTypeLabel = (type: string) => {
    switch (type) {
      case 'contact': return 'Contact Form';
      case 'custom_pricing': return 'Custom Pricing';
      case 'support': return 'Support';
      default: return type;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">My Support Tickets</h1>
            <p className="text-muted-foreground mt-1">View and manage your support requests</p>
          </div>
          <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Support Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue in detail..."
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    rows={5}
                  />
                </div>
                <Button 
                  onClick={createTicket} 
                  disabled={creatingTicket || !newTicketSubject.trim() || !newTicketMessage.trim()}
                  className="w-full"
                >
                  {creatingTicket ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit Ticket
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tickets List */}
          <div className="lg:col-span-1 space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tickets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No support tickets yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowNewTicket(true)}>
                    Create Your First Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              tickets.map((ticket) => (
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
                      {getStatusBadge(ticket.status)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ticket.created_at), 'MMM dd')}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1">{ticket.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.message}</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      {getTicketTypeLabel(ticket.ticket_type)}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Conversation View */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        {getStatusBadge(selectedTicket.status)}
                        <span>•</span>
                        <span>{format(new Date(selectedTicket.created_at), 'MMMM dd, yyyy HH:mm')}</span>
                      </CardDescription>
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
                        <div key={msg.id} className={`flex gap-3 ${msg.is_admin ? '' : 'flex-row-reverse'}`}>
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.is_admin ? 'bg-green-500/10' : 'bg-primary/10'
                          }`}>
                            {msg.is_admin ? (
                              <ShieldCheck className="h-4 w-4 text-green-600" />
                            ) : (
                              <User className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className={`flex-1 ${msg.is_admin ? '' : 'text-right'}`}>
                            <div className={`rounded-lg p-3 inline-block max-w-[80%] ${
                              msg.is_admin 
                                ? 'bg-green-500/10 text-left' 
                                : 'bg-primary/10 text-left'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {msg.is_admin ? 'Support Team • ' : ''}
                              {format(new Date(msg.created_at), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Legacy admin_response display */}
                      {selectedTicket.admin_response && messages.length === 0 && (
                        <div className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <div className="bg-green-500/10 rounded-lg p-3">
                              <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              Support Team • {selectedTicket.responded_at && format(new Date(selectedTicket.responded_at), 'MMM dd, HH:mm')}
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
              <Card className="h-[600px] flex items-center justify-center">
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
