import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { 
  Mail, 
  Users, 
  Send, 
  Megaphone,
  CreditCard,
  FileText,
  History,
  CheckCircle,
  AlertCircle,
  Eye,
  Clock,
  Trash2,
  RefreshCw,
  Gift,
  PartyPopper,
  UserPlus,
  Settings2,
  Copy,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

type EmailType = 'announcement' | 'payment_reminder' | 'document_status' | 'promotional' | 'welcome' | 'custom';
type TargetAudience = 'all' | 'customers' | 'staff' | 'admins';

interface EmailLog {
  id: string;
  type: string;
  subject: string;
  title: string;
  message: string;
  cta_text: string | null;
  cta_url: string | null;
  target_audience: string;
  recipient_count: number;
  success_count: number;
  failed_count: number;
  status: string;
  sent_by: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const emailTypeConfig: Record<EmailType, { label: string; icon: React.ElementType; color: string; description: string }> = {
  announcement: { 
    label: 'Announcement', 
    icon: Megaphone, 
    color: 'bg-blue-500/10 text-blue-500',
    description: 'Important announcements for users'
  },
  payment_reminder: { 
    label: 'Payment Reminder', 
    icon: CreditCard, 
    color: 'bg-amber-500/10 text-amber-500',
    description: 'Remind about pending payments'
  },
  document_status: { 
    label: 'Document Status', 
    icon: FileText, 
    color: 'bg-green-500/10 text-green-500',
    description: 'Document processing updates'
  },
  promotional: { 
    label: 'Promotional', 
    icon: Gift, 
    color: 'bg-pink-500/10 text-pink-500',
    description: 'Special offers and discounts'
  },
  welcome: { 
    label: 'Welcome Email', 
    icon: UserPlus, 
    color: 'bg-cyan-500/10 text-cyan-500',
    description: 'Welcome new users'
  },
  custom: { 
    label: 'Custom Email', 
    icon: Mail, 
    color: 'bg-purple-500/10 text-purple-500',
    description: 'Custom content email'
  },
};

const audienceConfig: Record<TargetAudience, { label: string; description: string; icon: React.ElementType }> = {
  all: { label: 'All Users', description: 'Send to everyone', icon: Users },
  customers: { label: 'Customers Only', description: 'Only registered customers', icon: Users },
  staff: { label: 'Staff Only', description: 'Only staff members', icon: Users },
  admins: { label: 'Admins Only', description: 'Only admin users', icon: Settings2 },
};

const emailTemplates: Record<EmailType, { subject: string; title: string; message: string; ctaText: string; ctaUrl: string }> = {
  announcement: {
    subject: 'Important Announcement from PlagaiScans',
    title: 'Important Update',
    message: 'We have an important announcement to share with you.\n\nPlease read this carefully as it may affect your experience with our service.',
    ctaText: 'Learn More',
    ctaUrl: 'https://plagaiscans.com'
  },
  payment_reminder: {
    subject: 'Complete Your Payment - PlagaiScans',
    title: 'Payment Reminder',
    message: 'You have a pending payment or low credit balance.\n\nPlease complete your payment to continue using our document scanning services without interruption.',
    ctaText: 'Buy Credits Now',
    ctaUrl: 'https://plagaiscans.com/dashboard/credits'
  },
  document_status: {
    subject: 'Your Document Status Update - PlagaiScans',
    title: 'Document Processing Update',
    message: 'We wanted to update you on the status of your submitted documents.\n\nYour documents are being processed and you will receive the results shortly.',
    ctaText: 'View Documents',
    ctaUrl: 'https://plagaiscans.com/dashboard/documents'
  },
  promotional: {
    subject: '🎉 Special Offer Just For You! - PlagaiScans',
    title: 'Exclusive Offer',
    message: 'We have a special offer just for you!\n\nFor a limited time, get extra credits when you make a purchase. Don\'t miss this opportunity!',
    ctaText: 'Claim Offer',
    ctaUrl: 'https://plagaiscans.com/dashboard/credits'
  },
  welcome: {
    subject: 'Welcome to PlagaiScans! 👋',
    title: 'Welcome Aboard!',
    message: 'Thank you for joining PlagaiScans!\n\nWe\'re excited to have you with us. Our platform helps you check documents for plagiarism and AI content with accurate results.\n\nGet started by uploading your first document.',
    ctaText: 'Get Started',
    ctaUrl: 'https://plagaiscans.com/dashboard'
  },
  custom: {
    subject: '',
    title: '',
    message: '',
    ctaText: '',
    ctaUrl: ''
  }
};

export const AdminEmailPanel: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Form state
  const [emailType, setEmailType] = useState<EmailType>('announcement');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [subject, setSubject] = useState(emailTemplates.announcement.subject);
  const [title, setTitle] = useState(emailTemplates.announcement.title);
  const [message, setMessage] = useState(emailTemplates.announcement.message);
  const [ctaText, setCtaText] = useState(emailTemplates.announcement.ctaText);
  const [ctaUrl, setCtaUrl] = useState(emailTemplates.announcement.ctaUrl);
  const [includeCta, setIncludeCta] = useState(true);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  // Get user count based on audience
  const { data: userCounts, isLoading: countsLoading } = useQuery({
    queryKey: ['user-counts-for-email'],
    queryFn: async () => {
      const { count: totalCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      
      const { data: customerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'customer');
      
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'staff');

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      return {
        all: totalCount || 0,
        customers: customerRoles?.length || 0,
        staff: staffRoles?.length || 0,
        admins: adminRoles?.length || 0
      };
    }
  });

  // Fetch email logs from database
  const { data: emailLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as EmailLog[];
    }
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      // First create a log entry
      const { data: logEntry, error: logError } = await supabase
        .from('email_logs')
        .insert({
          type: emailType,
          subject,
          title,
          message,
          cta_text: includeCta ? ctaText : null,
          cta_url: includeCta ? ctaUrl : null,
          target_audience: targetAudience,
          recipient_count: userCounts?.[targetAudience] || 0,
          status: 'sending',
          sent_by: user?.id
        })
        .select()
        .single();

      if (logError) throw logError;

      // Then send the email
      const { data, error } = await supabase.functions.invoke('admin-send-email', {
        body: {
          type: emailType,
          targetAudience,
          subject,
          title,
          message,
          ctaText: includeCta ? ctaText : undefined,
          ctaUrl: includeCta ? ctaUrl : undefined,
          logId: logEntry.id
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Emails Sent Successfully!', 
        description: `Sent to ${data.sent} recipients${data.failed > 0 ? `, ${data.failed} failed` : ''}.` 
      });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to send emails', 
        description: error.message, 
        variant: 'destructive' 
      });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    }
  });

  // Delete email log mutation
  const deleteLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('email_logs')
        .delete()
        .eq('id', logId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Email log deleted' });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to delete log', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  const handleTypeChange = (type: EmailType) => {
    setEmailType(type);
    const template = emailTemplates[type];
    setSubject(template.subject);
    setTitle(template.title);
    setMessage(template.message);
    setCtaText(template.ctaText);
    setCtaUrl(template.ctaUrl);
    setIncludeCta(type !== 'custom');
  };

  const handleSend = () => {
    if (!subject.trim() || !title.trim() || !message.trim()) {
      toast({ 
        title: 'Validation Error', 
        description: 'Subject, title, and message are required', 
        variant: 'destructive' 
      });
      return;
    }
    if (includeCta && ctaText && !ctaUrl) {
      toast({ 
        title: 'Validation Error', 
        description: 'Button URL is required when button text is provided', 
        variant: 'destructive' 
      });
      return;
    }
    sendEmailMutation.mutate();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const recipientCount = userCounts?.[targetAudience] || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3" /> Sent</Badge>;
      case 'partial':
        return <Badge className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20"><AlertCircle className="h-3 w-3" /> Partial</Badge>;
      case 'sending':
        return <Badge className="gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20"><Loader2 className="h-3 w-3 animate-spin" /> Sending</Badge>;
      case 'failed':
        return <Badge className="gap-1 bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
      case 'scheduled':
        return <Badge className="gap-1 bg-purple-500/10 text-purple-500 border-purple-500/20"><Clock className="h-3 w-3" /> Scheduled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Email preview component
  const EmailPreview = () => (
    <div className="bg-muted/50 rounded-lg p-4 max-w-xl mx-auto">
      <div className="bg-background rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 text-center">
          <div className="bg-white/20 backdrop-blur w-14 h-14 rounded-xl mx-auto flex items-center justify-center">
            <span className="text-2xl">
              {emailType === 'announcement' ? '📢' : 
               emailType === 'payment_reminder' ? '💳' : 
               emailType === 'document_status' ? '📄' : 
               emailType === 'promotional' ? '🎉' : 
               emailType === 'welcome' ? '👋' : '📧'}
            </span>
          </div>
        </div>
        <div className="p-6">
          <h2 className="text-xl font-bold text-center mb-4">{title || 'Email Title'}</h2>
          <div className="text-muted-foreground whitespace-pre-wrap mb-6">
            {message || 'Your email message will appear here...'}
          </div>
          {includeCta && ctaText && (
            <div className="text-center mb-6">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                {ctaText}
              </Button>
            </div>
          )}
          <hr className="my-4" />
          <p className="text-xs text-center text-muted-foreground">
            This email was sent from PlagaiScans.<br />
            <a href="#" className="text-blue-500">Visit our website</a>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="compose" className="gap-2">
            <Mail className="h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Email Type Selection */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Email Type</CardTitle>
                <CardDescription>Select the type of email to send</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(emailTypeConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key as EmailType)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      emailType === key 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.color}`}>
                        <config.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Email Content */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Email Content
                    </CardTitle>
                    <CardDescription>
                      Powered by SendPlus SMTP
                    </CardDescription>
                  </div>
                  <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Email Preview</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[70vh]">
                        <EmailPreview />
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target Audience */}
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(audienceConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setTargetAudience(key as TargetAudience)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          targetAudience === key 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <config.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {countsLoading ? '...' : userCounts?.[key as TargetAudience] || 0} users
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="font-medium"
                  />
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Email Title (shown in email body)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter email title..."
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your email message..."
                    rows={6}
                    className="resize-none"
                  />
                </div>

                {/* CTA Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <Label htmlFor="include-cta" className="cursor-pointer">Include Call-to-Action Button</Label>
                    <p className="text-xs text-muted-foreground">Add a button linking to a URL</p>
                  </div>
                  <Switch
                    id="include-cta"
                    checked={includeCta}
                    onCheckedChange={setIncludeCta}
                  />
                </div>

                {/* CTA Fields */}
                {includeCta && (
                  <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label htmlFor="ctaText">Button Text</Label>
                      <Input
                        id="ctaText"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="e.g., Learn More"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ctaUrl">Button URL</Label>
                      <Input
                        id="ctaUrl"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Will send to <span className="font-medium text-foreground">{recipientCount}</span> recipients
                  </div>
                  <Button 
                    onClick={handleSend}
                    disabled={sendEmailMutation.isPending || recipientCount === 0}
                    className="gap-2"
                    size="lg"
                  >
                    {sendEmailMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Pre-built templates for common email types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(emailTemplates).filter(([key]) => key !== 'custom').map(([key, template]) => {
                  const config = emailTypeConfig[key as EmailType];
                  return (
                    <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleTypeChange(key as EmailType)}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
                            <config.icon className="h-5 w-5" />
                          </div>
                          <CardTitle className="text-base">{config.label}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium mb-1 truncate">{template.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.message}</p>
                        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={(e) => {
                          e.stopPropagation();
                          handleTypeChange(key as EmailType);
                        }}>
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Email History</CardTitle>
                  <CardDescription>All emails sent from this panel</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : emailLogs?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No emails sent yet</p>
                  <p className="text-sm">Emails you send will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {emailLogs?.map((log) => {
                      const config = emailTypeConfig[log.type as EmailType] || emailTypeConfig.custom;
                      return (
                        <div key={log.id} className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                              <config.icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium truncate">{log.subject}</p>
                                {getStatusBadge(log.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                To: {audienceConfig[log.target_audience as TargetAudience]?.label || log.target_audience} 
                                {' • '}
                                {log.success_count}/{log.recipient_count} sent
                                {log.failed_count > 0 && ` • ${log.failed_count} failed`}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {log.sent_at 
                                  ? `Sent ${formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}`
                                  : `Created ${formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Email Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-muted-foreground">Subject</Label>
                                      <p className="font-medium">{log.subject}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Status</Label>
                                      <div className="mt-1">{getStatusBadge(log.status)}</div>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Audience</Label>
                                      <p>{audienceConfig[log.target_audience as TargetAudience]?.label || log.target_audience}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Recipients</Label>
                                      <p>{log.success_count} of {log.recipient_count} sent</p>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-muted-foreground">Title</Label>
                                    <p className="font-medium">{log.title}</p>
                                  </div>
                                  <div>
                                    <Label className="text-muted-foreground">Message</Label>
                                    <p className="whitespace-pre-wrap text-sm bg-muted/30 p-3 rounded-lg">{log.message}</p>
                                  </div>
                                  {log.cta_text && (
                                    <div className="flex items-center gap-2">
                                      <Button size="sm" variant="outline" className="gap-2">
                                        {log.cta_text}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(log.cta_url || '')}>
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {log.sent_at && (
                                      <p>Sent: {format(new Date(log.sent_at), 'PPpp')}</p>
                                    )}
                                    <p>Created: {format(new Date(log.created_at), 'PPpp')}</p>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteLogMutation.mutate(log.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
