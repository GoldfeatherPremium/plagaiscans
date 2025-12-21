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
import { toast } from '@/hooks/use-toast';
import { 
  Mail, 
  Users, 
  Send, 
  Megaphone,
  CreditCard,
  FileText,
  KeyRound,
  History,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type EmailType = 'announcement' | 'payment_reminder' | 'document_status' | 'custom';
type TargetAudience = 'all' | 'customers' | 'staff';

interface EmailLog {
  id: string;
  type: EmailType;
  subject: string;
  recipientCount: number;
  sentAt: Date;
  status: 'success' | 'partial' | 'failed';
}

const emailTypeConfig: Record<EmailType, { label: string; icon: React.ElementType; color: string; description: string }> = {
  announcement: { 
    label: 'Announcement', 
    icon: Megaphone, 
    color: 'bg-blue-500/10 text-blue-500',
    description: 'Send important announcements to users'
  },
  payment_reminder: { 
    label: 'Payment Reminder', 
    icon: CreditCard, 
    color: 'bg-amber-500/10 text-amber-500',
    description: 'Remind users about pending payments'
  },
  document_status: { 
    label: 'Document Status', 
    icon: FileText, 
    color: 'bg-green-500/10 text-green-500',
    description: 'Update users about their document processing'
  },
  custom: { 
    label: 'Custom Email', 
    icon: Mail, 
    color: 'bg-purple-500/10 text-purple-500',
    description: 'Send a custom email with your own content'
  },
};

const audienceConfig: Record<TargetAudience, { label: string; description: string }> = {
  all: { label: 'All Users', description: 'Send to everyone' },
  customers: { label: 'Customers Only', description: 'Only registered customers' },
  staff: { label: 'Staff Only', description: 'Only staff members' },
};

const emailTemplates = {
  announcement: {
    subject: 'Important Announcement from PlagaiScans',
    title: 'Important Update',
    message: 'We have an important announcement to share with you.',
    ctaText: 'Learn More',
    ctaUrl: 'https://plagaiscans.com'
  },
  payment_reminder: {
    subject: 'Complete Your Payment - PlagaiScans',
    title: 'Payment Reminder',
    message: 'You have a pending payment. Please complete your payment to continue using our services.',
    ctaText: 'Buy Credits',
    ctaUrl: 'https://plagaiscans.com/dashboard/credits'
  },
  document_status: {
    subject: 'Your Document Status Update',
    title: 'Document Processing Update',
    message: 'We wanted to update you on the status of your submitted documents.',
    ctaText: 'View Documents',
    ctaUrl: 'https://plagaiscans.com/dashboard/documents'
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
  const queryClient = useQueryClient();
  
  // Form state
  const [emailType, setEmailType] = useState<EmailType>('announcement');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [subject, setSubject] = useState(emailTemplates.announcement.subject);
  const [title, setTitle] = useState(emailTemplates.announcement.title);
  const [message, setMessage] = useState(emailTemplates.announcement.message);
  const [ctaText, setCtaText] = useState(emailTemplates.announcement.ctaText);
  const [ctaUrl, setCtaUrl] = useState(emailTemplates.announcement.ctaUrl);
  
  // Email logs (stored in local state for now)
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Get user count based on audience
  const { data: userCounts } = useQuery({
    queryKey: ['user-counts-for-email'],
    queryFn: async () => {
      const { data: allUsers, count: totalCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' });
      
      const { data: customerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'customer');
      
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'staff');
      
      return {
        all: totalCount || 0,
        customers: customerRoles?.length || 0,
        staff: staffRoles?.length || 0
      };
    }
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-send-email', {
        body: {
          type: emailType,
          targetAudience,
          subject,
          title,
          message,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Emails Sent!', 
        description: `Successfully sent to ${data.sent} recipients.` 
      });
      
      // Add to logs
      setEmailLogs(prev => [{
        id: Date.now().toString(),
        type: emailType,
        subject,
        recipientCount: data.sent,
        sentAt: new Date(),
        status: data.failed > 0 ? 'partial' : 'success'
      }, ...prev]);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to send emails', 
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
    sendEmailMutation.mutate();
  };

  const recipientCount = userCounts?.[targetAudience] || 0;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compose" className="gap-2">
            <Mail className="h-4 w-4" />
            Compose Email
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Sent History
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
              <CardContent className="space-y-3">
                {Object.entries(emailTypeConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key as EmailType)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      emailType === key 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
                        <config.icon className="h-5 w-5" />
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
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Email Content
                </CardTitle>
                <CardDescription>
                  Emails will be sent from noreply@plagaiscans.com
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target Audience */}
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(audienceConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {config.label} ({userCounts?.[key as TargetAudience] || 0} users)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
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
                    rows={5}
                  />
                </div>

                {/* CTA */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ctaText">Button Text (optional)</Label>
                    <Input
                      id="ctaText"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="e.g., Learn More"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctaUrl">Button URL (optional)</Label>
                    <Input
                      id="ctaUrl"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Send Button */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Will send to <span className="font-medium text-foreground">{recipientCount}</span> recipients
                  </div>
                  <Button 
                    onClick={handleSend}
                    disabled={sendEmailMutation.isPending || recipientCount === 0}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email History</CardTitle>
              <CardDescription>Recent emails sent from this panel</CardDescription>
            </CardHeader>
            <CardContent>
              {emailLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No emails sent yet</p>
                  <p className="text-sm">Emails you send will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailLogs.map((log) => {
                    const config = emailTypeConfig[log.type];
                    return (
                      <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
                            <config.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{log.subject}</p>
                            <p className="text-sm text-muted-foreground">
                              Sent to {log.recipientCount} recipients • {formatDistanceToNow(log.sentAt, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="gap-1">
                          {log.status === 'success' ? (
                            <><CheckCircle className="h-3 w-3" /> Sent</>
                          ) : (
                            <><AlertCircle className="h-3 w-3" /> Partial</>
                          )}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};