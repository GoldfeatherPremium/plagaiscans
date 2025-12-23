import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Users, Loader2, Bell, Search } from 'lucide-react';

type TargetAudience = 'all' | 'customers' | 'staff' | 'admins' | 'specific';

const audienceOptions: { value: TargetAudience; label: string; description: string }[] = [
  { value: 'all', label: 'All Users', description: 'Send to everyone with push enabled' },
  { value: 'customers', label: 'Customers Only', description: 'Only customer accounts' },
  { value: 'staff', label: 'Staff Only', description: 'Only staff members' },
  { value: 'admins', label: 'Admins Only', description: 'Only administrators' },
  { value: 'specific', label: 'Specific User', description: 'Send to a single user' },
];

export const AdminPushNotificationSender: React.FC = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/dashboard');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [specificUserId, setSpecificUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Search for users when targeting specific
  const { data: searchResults } = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: async () => {
      if (!userSearch || userSearch.length < 2) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .or(`email.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: targetAudience === 'specific' && userSearch.length >= 2,
  });

  // Get subscription counts for preview
  const { data: subscriptionCounts } = useQuery({
    queryKey: ['push-subscription-counts'],
    queryFn: async () => {
      // Get all subscriptions with user roles
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('user_id');

      if (!subs || subs.length === 0) return { all: 0, customers: 0, staff: 0, admins: 0 };

      const userIds = [...new Set(subs.map(s => s.user_id))];
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const counts = { all: userIds.length, customers: 0, staff: 0, admins: 0 };
      
      roles?.forEach(r => {
        if (r.role === 'customer') counts.customers++;
        if (r.role === 'staff') counts.staff++;
        if (r.role === 'admin') counts.admins++;
      });

      return counts;
    },
  });

  // Send push notification mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title,
        body,
        url,
        eventType: 'manual',
        sentBy: user?.id,
      };

      if (targetAudience === 'specific') {
        if (!specificUserId) throw new Error('Please select a user');
        payload.userId = specificUserId;
      } else if (targetAudience === 'all') {
        payload.sendToAll = true;
      } else {
        payload.targetAudience = targetAudience;
      }

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Push notification sent! ${data.sent} delivered, ${data.failed} failed`);
      // Reset form
      setTitle('');
      setBody('');
      setUrl('/dashboard');
      setSpecificUserId('');
      setUserSearch('');
    },
    onError: (error: Error) => {
      toast.error('Failed to send: ' + error.message);
    },
  });

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    sendMutation.mutate();
  };

  const getAudienceCount = () => {
    if (!subscriptionCounts) return 0;
    if (targetAudience === 'all') return subscriptionCounts.all;
    if (targetAudience === 'specific') return specificUserId ? 1 : 0;
    return subscriptionCounts[targetAudience] || 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Send Push Notification
        </CardTitle>
        <CardDescription>
          Send instant push notifications to users with enabled subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="push-title">Title</Label>
          <Input
            id="push-title"
            placeholder="Notification title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="push-body">Message</Label>
          <Textarea
            id="push-body"
            placeholder="Write your notification message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={300}
          />
          <p className="text-xs text-muted-foreground text-right">{body.length}/300</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="push-url">Open URL (on click)</Label>
          <Input
            id="push-url"
            placeholder="/dashboard"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Path to open when notification is clicked</p>
        </div>

        <div className="space-y-2">
          <Label>Target Audience</Label>
          <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {audienceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {audienceOptions.find(o => o.value === targetAudience)?.description}
          </p>
        </div>

        {targetAudience === 'specific' && (
          <div className="space-y-2">
            <Label>Search User</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchResults && searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                      specificUserId === user.id ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => {
                      setSpecificUserId(user.id);
                      setUserSearch(user.email);
                    }}
                  >
                    <p className="font-medium text-sm">{user.full_name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Will send to ~{getAudienceCount()} subscribed user(s)
          </p>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !title.trim() || !body.trim()}
            className="gap-2"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Push Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
