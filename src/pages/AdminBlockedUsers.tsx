import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ShieldBan, 
  Search,
  UserX,
  Unlock,
  User,
  Mail,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface BlockedUser {
  id: string;
  user_id: string;
  reason: string | null;
  blocked_at: string;
  user_email?: string;
  user_name?: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

export default function AdminBlockedUsers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unblockDialog, setUnblockDialog] = useState<BlockedUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch blocked users
    const { data: blocked } = await supabase
      .from('blocked_users')
      .select('*')
      .order('blocked_at', { ascending: false });

    if (blocked) {
      const userIds = blocked.map(b => b.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const blockedWithUsers = blocked.map(b => {
        const profile = profiles?.find(p => p.id === b.user_id);
        return {
          ...b,
          user_email: profile?.email,
          user_name: profile?.full_name,
        };
      });
      setBlockedUsers(blockedWithUsers);
    }

    // Fetch all users for blocking
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, full_name');
    
    if (users) setAllUsers(users);
    
    setLoading(false);
  };

  const blockUser = async () => {
    if (!selectedUser) return;

    setBlocking(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('blocked_users').insert({
      user_id: selectedUser.id,
      reason: blockReason || null,
      blocked_by: user?.id,
    });

    setBlocking(false);

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'User is already blocked', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Blocked', description: `${selectedUser.email} has been blocked` });
      setDialogOpen(false);
      setSelectedUser(null);
      setBlockReason('');
      fetchData();
    }
  };

  const unblockUser = async (blocked: BlockedUser) => {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('id', blocked.id);

    if (!error) {
      toast({ title: 'Unblocked', description: `${blocked.user_email} has been unblocked` });
      setBlockedUsers(blockedUsers.filter(b => b.id !== blocked.id));
    }
    setUnblockDialog(null);
  };

  const filteredBlockedUsers = blockedUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.user_email?.toLowerCase().includes(query) ||
      user.user_name?.toLowerCase().includes(query) ||
      user.reason?.toLowerCase().includes(query)
    );
  });

  const filteredAllUsers = allUsers.filter(user => {
    if (!userSearchQuery) return true;
    const query = userSearchQuery.toLowerCase();
    const isBlocked = blockedUsers.some(b => b.user_id === user.id);
    if (isBlocked) return false;
    return (
      user.email.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Blocked Users</h1>
            <p className="text-muted-foreground mt-1">Manage suspended user accounts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <UserX className="h-4 w-4 mr-2" />
                Block User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search User</Label>
                  <Input
                    placeholder="Search by email or name..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>

                {userSearchQuery && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {filteredAllUsers.slice(0, 10).map((user) => (
                      <div
                        key={user.id}
                        className={`p-3 cursor-pointer hover:bg-muted ${
                          selectedUser?.id === user.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    ))}
                    {filteredAllUsers.length === 0 && (
                      <p className="p-3 text-muted-foreground text-center">No users found</p>
                    )}
                  </div>
                )}

                {selectedUser && (
                  <Card className="bg-destructive/5 border-destructive/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-medium">Selected: {selectedUser.email}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Textarea
                    placeholder="Enter reason for blocking..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  variant="destructive"
                  onClick={blockUser}
                  disabled={!selectedUser || blocking}
                  className="w-full"
                >
                  {blocking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldBan className="h-4 w-4 mr-2" />}
                  Block User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShieldBan className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Blocked Users</p>
              <p className="text-2xl font-bold">{blockedUsers.length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blocked users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Blocked Users Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBlockedUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldBan className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No blocked users</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          User
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                      </TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Blocked At
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlockedUsers.map((blocked) => (
                      <TableRow key={blocked.id}>
                        <TableCell className="font-medium">
                          {blocked.user_name || <span className="text-muted-foreground">No name</span>}
                        </TableCell>
                        <TableCell>{blocked.user_email}</TableCell>
                        <TableCell className="max-w-[200px]">
                          {blocked.reason ? (
                            <span className="truncate block">{blocked.reason}</span>
                          ) : (
                            <span className="text-muted-foreground">No reason provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(blocked.blocked_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUnblockDialog(blocked)}
                          >
                            <Unlock className="h-4 w-4 mr-2" />
                            Unblock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unblock Confirmation */}
      <AlertDialog open={!!unblockDialog} onOpenChange={() => setUnblockDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unblock {unblockDialog?.user_email}? They will regain access to the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unblockDialog && unblockUser(unblockDialog)}>
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
