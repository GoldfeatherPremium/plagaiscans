import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, User, Mail, Phone, CreditCard, Calendar, History, TrendingUp, TrendingDown, ArrowUpDown, UserPlus, Clock, Users, Settings2, Save, CalendarClock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  credit_balance: number;
  similarity_credit_balance: number;
  created_at: string;
  role?: 'admin' | 'staff' | 'customer';
}

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_type: string;
  credit_type: string;
  description: string | null;
  performed_by: string | null;
  created_at: string;
}

interface UserStats {
  totalAdded: number;
  totalDeducted: number;
  totalUsage: number;
  transactionCount: number;
}

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  time_limit_minutes: number;
  max_concurrent_files: number;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [similarityCreditInputs, setSimilarityCreditInputs] = useState<Record<string, string>>({});
  const [creditExpiryDates, setCreditExpiryDates] = useState<Record<string, Date | undefined>>({});
  const [similarityCreditExpiryDates, setSimilarityCreditExpiryDates] = useState<Record<string, Date | undefined>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Role assignment state
  const [selectedUserForRole, setSelectedUserForRole] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'customer'>('staff');

  // Staff settings state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchStaffWithSettings();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && profiles) {
      // Fetch roles for all users
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      const usersWithRoles = profiles.map(profile => ({
        ...profile,
        role: roleMap.get(profile.id) || 'customer'
      }));
      
      setUsers(usersWithRoles);
    }
    setLoading(false);
  };

  const fetchStaffWithSettings = async () => {
    const { data: staffRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'staff');

    if (!staffRoles || staffRoles.length === 0) {
      setStaffMembers([]);
      return;
    }

    const staffIds = staffRoles.map(r => r.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', staffIds);

    const { data: settings } = await supabase
      .from('staff_settings')
      .select('*')
      .in('user_id', staffIds);

    const merged: StaffMember[] = (profiles || []).map(profile => {
      const setting = settings?.find(s => s.user_id === profile.id);
      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        time_limit_minutes: setting?.time_limit_minutes ?? 30,
        max_concurrent_files: setting?.max_concurrent_files ?? 1,
      };
    });

    setStaffMembers(merged);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const updateCredits = async (userId: string, amount: number, creditType: 'full' | 'similarity_only' = 'full') => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    
    const currentBalance = creditType === 'full' ? user.credit_balance : user.similarity_credit_balance;
    const newBalance = currentBalance + amount;
    
    if (newBalance < 0) {
      toast({ title: 'Error', description: 'Balance cannot be negative', variant: 'destructive' });
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const updateField = creditType === 'full' ? 'credit_balance' : 'similarity_credit_balance';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [updateField]: newBalance })
      .eq('id', userId);

    if (updateError) {
      toast({ title: 'Error', description: 'Failed to update credits', variant: 'destructive' });
      return;
    }

    const expiryDate = creditType === 'full' 
      ? creditExpiryDates[userId] 
      : similarityCreditExpiryDates[userId];

    const description = creditType === 'full' 
      ? (amount > 0 ? 'Full credits added by admin' : 'Full credits deducted by admin')
      : (amount > 0 ? 'Similarity credits added by admin' : 'Similarity credits deducted by admin');

    const { data: transactionData, error: logError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        transaction_type: amount > 0 ? 'add' : 'deduct',
        credit_type: creditType,
        description,
        performed_by: currentUser?.id
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Failed to log transaction:', logError);
    }

    // If adding credits and expiry date is set, create credit_validity record
    if (amount > 0 && expiryDate) {
      const { error: validityError } = await supabase
        .from('credit_validity')
        .insert({
          user_id: userId,
          credits_amount: amount,
          remaining_credits: amount,
          expires_at: expiryDate.toISOString(),
          credit_type: creditType,
          transaction_id: transactionData?.id || null
        });

      if (validityError) {
        console.error('Failed to create credit validity:', validityError);
      }
    }

    toast({ 
      title: 'Success', 
      description: `${creditType === 'full' ? 'Full' : 'Similarity'} credits updated${expiryDate && amount > 0 ? ` (expires ${format(expiryDate, 'PPP')})` : ''}` 
    });
    fetchUsers();
    setCreditInputs({ ...creditInputs, [userId]: '' });
    setSimilarityCreditInputs({ ...similarityCreditInputs, [userId]: '' });
    setCreditExpiryDates({ ...creditExpiryDates, [userId]: undefined });
    setSimilarityCreditExpiryDates({ ...similarityCreditExpiryDates, [userId]: undefined });
  };

  const fetchUserHistory = async (user: UserProfile) => {
    setSelectedUser(user);
    setLoadingHistory(true);
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTransactions(data);
      
      const stats: UserStats = {
        totalAdded: 0,
        totalDeducted: 0,
        totalUsage: 0,
        transactionCount: data.length
      };
      
      data.forEach(tx => {
        if (tx.transaction_type === 'add') {
          stats.totalAdded += tx.amount;
        } else if (tx.transaction_type === 'deduct') {
          stats.totalDeducted += Math.abs(tx.amount);
        } else if (tx.transaction_type === 'usage') {
          stats.totalUsage += Math.abs(tx.amount);
        }
      });
      
      setUserStats(stats);
    }
    
    setLoadingHistory(false);
  };

  const assignRole = async () => {
    if (!selectedUserForRole || !selectedRole) return;

    await supabase.from('user_roles').delete().eq('user_id', selectedUserForRole);

    const { error } = await supabase.from('user_roles').insert({ user_id: selectedUserForRole, role: selectedRole });

    if (error) {
      toast({ title: 'Error', description: 'Failed to assign role', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Role assigned: ${selectedRole}` });
      setSelectedUserForRole('');
      fetchStaffWithSettings();
    }
  };

  const updateStaffLimit = (staffId: string, field: 'time_limit_minutes' | 'max_concurrent_files', value: number) => {
    setStaffMembers(prev => prev.map(s => 
      s.id === staffId ? { ...s, [field]: value } : s
    ));
  };

  const saveStaffSettings = async (staff: StaffMember) => {
    setSavingStaffId(staff.id);
    
    const { error } = await supabase
      .from('staff_settings')
      .upsert({
        user_id: staff.id,
        time_limit_minutes: staff.time_limit_minutes,
        max_concurrent_files: staff.max_concurrent_files,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    setSavingStaffId(null);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save staff settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Settings saved for ${staff.full_name || staff.email}` });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles, staff settings & credits</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">All Users</TabsTrigger>
            <TabsTrigger value="roles">Role Assignment</TabsTrigger>
            <TabsTrigger value="staff">Staff Settings</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No users found matching your search' : 'No users found'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Name
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          </TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Phone
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Joined
                            </div>
                          </TableHead>
                          <TableHead className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Full Credits
                            </div>
                          </TableHead>
                          <TableHead className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Similarity Credits
                            </div>
                          </TableHead>
                          <TableHead className="text-center">History</TableHead>
                          <TableHead className="text-center">Full Credit Actions</TableHead>
                          <TableHead className="text-center">Similarity Credit Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user, index) => (
                          <TableRow key={user.id}>
                            <TableCell className="text-center font-medium">{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {user.full_name || <span className="text-muted-foreground">No name</span>}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  user.role === 'admin' ? 'destructive' : 
                                  user.role === 'staff' ? 'default' : 
                                  'secondary'
                                }
                                className="capitalize"
                              >
                                {user.role || 'customer'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.phone || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>{formatDate(user.created_at)}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-lg font-bold text-primary">{user.credit_balance}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-lg font-bold text-blue-600">{user.similarity_credit_balance}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => fetchUserHistory(user)}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="Amount"
                                  className="w-20 h-8 text-sm"
                                  value={creditInputs[user.id] || ''}
                                  onChange={(e) =>
                                    setCreditInputs({ ...creditInputs, [user.id]: e.target.value })
                                  }
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "w-[100px] h-8 text-xs justify-start text-left font-normal",
                                        !creditExpiryDates[user.id] && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarClock className="mr-1 h-3 w-3" />
                                      {creditExpiryDates[user.id] ? format(creditExpiryDates[user.id], "MMM d") : "Expiry"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={creditExpiryDates[user.id]}
                                      onSelect={(date) => setCreditExpiryDates({ ...creditExpiryDates, [user.id]: date })}
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                      className="p-3 pointer-events-auto"
                                    />
                                    <div className="p-2 border-t flex gap-1">
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setCreditExpiryDates({ ...creditExpiryDates, [user.id]: addDays(new Date(), 30) })}>30d</Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setCreditExpiryDates({ ...creditExpiryDates, [user.id]: addDays(new Date(), 60) })}>60d</Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setCreditExpiryDates({ ...creditExpiryDates, [user.id]: addDays(new Date(), 90) })}>90d</Button>
                                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setCreditExpiryDates({ ...creditExpiryDates, [user.id]: undefined })}>Clear</Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  size="sm"
                                  onClick={() => updateCredits(user.id, parseInt(creditInputs[user.id]) || 0, 'full')}
                                >
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateCredits(user.id, -(parseInt(creditInputs[user.id]) || 0), 'full')
                                  }
                                >
                                  Deduct
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="Amount"
                                  className="w-20 h-8 text-sm"
                                  value={similarityCreditInputs[user.id] || ''}
                                  onChange={(e) =>
                                    setSimilarityCreditInputs({ ...similarityCreditInputs, [user.id]: e.target.value })
                                  }
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "w-[100px] h-8 text-xs justify-start text-left font-normal",
                                        !similarityCreditExpiryDates[user.id] && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarClock className="mr-1 h-3 w-3" />
                                      {similarityCreditExpiryDates[user.id] ? format(similarityCreditExpiryDates[user.id], "MMM d") : "Expiry"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={similarityCreditExpiryDates[user.id]}
                                      onSelect={(date) => setSimilarityCreditExpiryDates({ ...similarityCreditExpiryDates, [user.id]: date })}
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                      className="p-3 pointer-events-auto"
                                    />
                                    <div className="p-2 border-t flex gap-1">
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSimilarityCreditExpiryDates({ ...similarityCreditExpiryDates, [user.id]: addDays(new Date(), 30) })}>30d</Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSimilarityCreditExpiryDates({ ...similarityCreditExpiryDates, [user.id]: addDays(new Date(), 60) })}>60d</Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSimilarityCreditExpiryDates({ ...similarityCreditExpiryDates, [user.id]: addDays(new Date(), 90) })}>90d</Button>
                                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSimilarityCreditExpiryDates({ ...similarityCreditExpiryDates, [user.id]: undefined })}>Clear</Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700"
                                  onClick={() => updateCredits(user.id, parseInt(similarityCreditInputs[user.id]) || 0, 'similarity_only')}
                                >
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateCredits(user.id, -(parseInt(similarityCreditInputs[user.id]) || 0), 'similarity_only')
                                  }
                                >
                                  Deduct
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">
              Total users: {users.length} {searchQuery && `(${filteredUsers.length} matching search)`}
            </p>
          </TabsContent>

          {/* Role Assignment Tab */}
          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Assign User Roles
                </CardTitle>
                <CardDescription>Promote users to staff or admin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUserForRole} onValueChange={setSelectedUserForRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign Role</Label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'staff' | 'customer')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={assignRole} disabled={!selectedUserForRole}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Settings Tab */}
          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Staff Individual Limits
                </CardTitle>
                <CardDescription>Set custom time limits and file quotas for each staff member</CardDescription>
              </CardHeader>
              <CardContent>
                {staffMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No staff members found. Assign staff roles in the "Role Assignment" tab.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Member</TableHead>
                          <TableHead className="w-36">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Time Limit (min)
                            </div>
                          </TableHead>
                          <TableHead className="w-36">Max Files</TableHead>
                          <TableHead className="w-24 text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffMembers.map((staff) => (
                          <TableRow key={staff.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{staff.full_name || 'Unnamed'}</div>
                                <div className="text-sm text-muted-foreground">{staff.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="5"
                                max="1440"
                                value={staff.time_limit_minutes}
                                onChange={(e) => updateStaffLimit(staff.id, 'time_limit_minutes', parseInt(e.target.value) || 30)}
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                max="20"
                                value={staff.max_concurrent_files}
                                onChange={(e) => updateStaffLimit(staff.id, 'max_concurrent_files', parseInt(e.target.value) || 1)}
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                size="sm" 
                                onClick={() => saveStaffSettings(staff)}
                                disabled={savingStaffId === staff.id}
                              >
                                {savingStaffId === staff.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credit History Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Credit History - {selectedUser?.full_name || selectedUser?.email}
            </DialogTitle>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 overflow-hidden flex flex-col">
              {userStats && (
                <div className="grid grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-xs text-muted-foreground">Current Balance</div>
                      <div className="text-xl font-bold text-primary">{selectedUser?.credit_balance}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        Total Added
                      </div>
                      <div className="text-xl font-bold text-green-600">{userStats.totalAdded}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        Total Deducted
                      </div>
                      <div className="text-xl font-bold text-red-600">{userStats.totalDeducted}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <ArrowUpDown className="h-3 w-3" />
                        Transactions
                      </div>
                      <div className="text-xl font-bold">{userStats.transactionCount}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="overflow-auto flex-1 max-h-[400px]">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No credit transactions found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Credit Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Before</TableHead>
                        <TableHead className="text-right">After</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">
                            {formatDateTime(tx.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={tx.transaction_type === 'add' ? 'default' : 'secondary'}
                              className={tx.transaction_type === 'add' ? 'bg-green-500' : tx.transaction_type === 'deduct' ? 'bg-red-500' : ''}
                            >
                              {tx.transaction_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={tx.credit_type === 'similarity_only' ? 'border-blue-500 text-blue-600' : 'border-primary text-primary'}
                            >
                              {tx.credit_type === 'similarity_only' ? 'Similarity' : 'Full'}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {tx.balance_before}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {tx.balance_after}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {tx.description || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
