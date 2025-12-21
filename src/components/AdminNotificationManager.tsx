import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Send, 
  Eye, 
  Bell, 
  Users, 
  Megaphone, 
  Settings2, 
  Sparkles,
  Trash2,
  ToggleLeft,
  Clock,
  Tag
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type NotificationCategory = 'system' | 'promotional' | 'updates';
type TargetAudience = 'all' | 'customers' | 'staff' | 'admins';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  target_audience: TargetAudience;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

const categoryConfig: Record<NotificationCategory, { label: string; icon: React.ElementType; color: string }> = {
  system: { label: 'System', icon: Settings2, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  promotional: { label: 'Promotional', icon: Sparkles, color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' },
  updates: { label: 'Updates', icon: Megaphone, color: 'bg-green-500/10 text-green-500 border-green-500/30' },
};

const audienceConfig: Record<TargetAudience, { label: string; description: string }> = {
  all: { label: 'All Users', description: 'Everyone will receive this notification' },
  customers: { label: 'Customers Only', description: 'Only customers will see this' },
  staff: { label: 'Staff Only', description: 'Only staff members will see this' },
  admins: { label: 'Admins Only', description: 'Only administrators will see this' },
};

export const AdminNotificationManager: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('system');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');

  // Fetch existing notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Notification[];
    },
  });

  // Create notification mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title,
          message,
          category,
          target_audience: targetAudience,
          is_active: true,
          created_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({ title: 'Notification sent', description: 'Your notification has been broadcast successfully.' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({ title: 'Status updated' });
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({ title: 'Notification deleted' });
    },
  });

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setCategory('system');
    setTargetAudience('all');
  };

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Validation error', description: 'Title and message are required', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  const CategoryBadge = ({ cat }: { cat: NotificationCategory }) => {
    const config = categoryConfig[cat];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn('gap-1', config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create" className="gap-2">
            <Send className="h-4 w-4" />
            Create Notification
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  New Notification
                </CardTitle>
                <CardDescription>
                  Create and send a notification to your users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Notification title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Write your notification message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length}/500
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as NotificationCategory)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {audienceConfig[targetAudience].description}
                </p>

                <div className="flex gap-2 pt-4">
                  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2" disabled={!title && !message}>
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Notification Preview</DialogTitle>
                        <DialogDescription>
                          This is how your notification will appear to users
                        </DialogDescription>
                      </DialogHeader>
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{title || 'Notification Title'}</h4>
                              <CategoryBadge cat={category} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {message || 'Your notification message will appear here...'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">Just now</p>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    onClick={handleSend} 
                    disabled={createMutation.isPending || !title.trim() || !message.trim()}
                    className="gap-2 flex-1"
                  >
                    <Send className="h-4 w-4" />
                    {createMutation.isPending ? 'Sending...' : 'Send Notification'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Category Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <div key={key} className="flex items-start gap-3">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', config.color)}>
                        <config.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {key === 'system' && 'Important system messages, maintenance alerts'}
                          {key === 'promotional' && 'Discounts, offers, new features'}
                          {key === 'updates' && 'Product updates, new releases'}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    User Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Users can opt-out of promotional and updates notifications in their profile settings. 
                    System notifications are always delivered.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
              <CardDescription>
                Manage previously sent notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications sent yet
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={cn(
                          "p-4 rounded-lg border transition-colors",
                          notif.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-medium truncate">{notif.title}</h4>
                              <CategoryBadge cat={notif.category as NotificationCategory} />
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {audienceConfig[notif.target_audience as TargetAudience]?.label || notif.target_audience}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notif.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={notif.is_active}
                                onCheckedChange={(checked) => toggleMutation.mutate({ id: notif.id, is_active: checked })}
                              />
                              <span className="text-xs text-muted-foreground">
                                {notif.is_active ? 'Active' : 'Hidden'}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(notif.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
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