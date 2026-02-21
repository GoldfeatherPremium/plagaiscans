import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, User, Mail, Phone, CreditCard, Calendar, History, TrendingUp, TrendingDown, ArrowUpDown, UserPlus, Clock, Users, Settings2, Save, ChevronLeft, ChevronRight, Shield, ShieldCheck, ShieldX, UserCog } from 'lucide-react';
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
import { CreditManagementDialog } from '@/components/CreditManagementDialog';
import { PreRegisterCreditDialog } from '@/components/PreRegisterCreditDialog';

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
  assigned_scan_types: string[];
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff' | 'customer'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Credit management dialog state
  const [creditDialogUser, setCreditDialogUser] = useState<UserProfile | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);

  // Role assignment state
  const [selectedUserForRole, setSelectedUserForRole] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'customer'>('staff');
  const [roleSearchQuery, setRoleSearchQuery] = useState('');

  // Staff settings state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [preRegisterOpen, setPreRegisterOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchStaffWithSettings();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50000);
    
    if (!error && profiles) {
      // Fetch roles for all users
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .limit(50000);
      
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
      .select('user_id, time_limit_minutes, max_concurrent_files, assigned_scan_types')
      .in('user_id', staffIds);

    const merged: StaffMember[] = (profiles || []).map(profile => {
      const setting = settings?.find(s => s.user_id === profile.id);
      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        time_limit_minutes: setting?.time_limit_minutes ?? 30,
        max_concurrent_files: setting?.max_concurrent_files ?? 1,
        assigned_scan_types: setting?.assigned_scan_types ?? ['full', 'similarity_only'],
      };
    });

    setStaffMembers(merged);
  };

  const USERS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== 'all') {
      result = result.filter(u => (u.role || 'customer') === roleFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.phone?.toLowerCase().includes(query)
      );
    }
    return result;
  }, [users, searchQuery, roleFilter]);

  // Reset page when search/filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const openCreditDialog = (user: UserProfile) => {
    setCreditDialogUser(user);
    setCreditDialogOpen(true);
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

  const assignRole = async (userId?: string, role?: 'admin' | 'staff' | 'customer') => {
    const targetUser = userId || selectedUserForRole;
    const targetRole = role || selectedRole;
    if (!targetUser || !targetRole) return;

    if (targetRole === 'customer') {
      // Remove from user_roles to make them a customer
      await supabase.from('user_roles').delete().eq('user_id', targetUser);
    } else {
      await supabase.from('user_roles').delete().eq('user_id', targetUser);
      const { error } = await supabase.from('user_roles').insert({ user_id: targetUser, role: targetRole });
      if (error) {
        toast({ title: 'Error', description: 'Failed to assign role', variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Success', description: `Role assigned: ${targetRole}` });
    setSelectedUserForRole('');
    fetchUsers();
    fetchStaffWithSettings();
  };

  const updateStaffLimit = (staffId: string, field: 'time_limit_minutes' | 'max_concurrent_files', value: number) => {
    setStaffMembers(prev => prev.map(s => 
      s.id === staffId ? { ...s, [field]: value } : s
    ));
  };

  const toggleStaffScanType = (staffId: string, scanType: string) => {
    setStaffMembers(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      const currentTypes = s.assigned_scan_types || ['full', 'similarity_only'];
      const hasType = currentTypes.includes(scanType);
      // Ensure at least one type is selected
      if (hasType && currentTypes.length === 1) return s;
      const newTypes = hasType 
        ? currentTypes.filter(t => t !== scanType)
        : [...currentTypes, scanType];
      return { ...s, assigned_scan_types: newTypes };
    }));
  };

  const saveStaffSettings = async (staff: StaffMember) => {
    setSavingStaffId(staff.id);
    
    const { error } = await supabase
      .from('staff_settings')
      .upsert({
        user_id: staff.id,
        time_limit_minutes: staff.time_limit_minutes,
        max_concurrent_files: staff.max_concurrent_files,
        assigned_scan_types: staff.assigned_scan_types,
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative max-w-md flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'customer', 'staff', 'admin'] as const).map((role) => (
                  <Button
                    key={role}
                    size="sm"
                    variant={roleFilter === role ? 'default' : 'outline'}
                    onClick={() => setRoleFilter(role)}
                    className="capitalize"
                  >
                    {role === 'all' ? 'All' : role}
                    {role !== 'all' && (
                      <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                        {users.filter(u => (u.role || 'customer') === role).length}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              <Button onClick={() => setPreRegisterOpen(true)} className="shrink-0">
                <UserPlus className="h-4 w-4 mr-2" />
                Pre-Register User
              </Button>
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
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((user, index) => (
                          <TableRow key={user.id}>
                            <TableCell className="text-center font-medium">{(currentPage - 1) * USERS_PER_PAGE + index + 1}</TableCell>
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
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => fetchUserHistory(user)}
                                  title="View History"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => openCreditDialog(user)}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Manage Credits
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * USERS_PER_PAGE + 1}–{Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                </p>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        className="w-9"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {totalPages <= 1 && (
              <p className="text-xs text-muted-foreground">
                Total users: {users.length} {searchQuery && `(${filteredUsers.length} matching search)`}
              </p>
            )}
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
                  <Label>Search & Select User</Label>
                  <Input
                    placeholder="Search by name or email..."
                    value={roleSearchQuery}
                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={selectedUserForRole} onValueChange={setSelectedUserForRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter(u => {
                          if (!roleSearchQuery.trim()) return true;
                          const q = roleSearchQuery.toLowerCase();
                          return u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                        })
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email} {user.full_name ? `(${user.email})` : ''}
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
                <Button onClick={() => assignRole()} disabled={!selectedUserForRole}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </CardContent>
            </Card>

            {/* Current Staff & Admins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Current Staff & Admins
                </CardTitle>
                <CardDescription>Manage existing staff and admin roles — demote or promote</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const staffAdmins = users.filter(u => u.role === 'staff' || u.role === 'admin');
                  if (staffAdmins.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No staff or admin users found.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Current Role</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffAdmins.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{user.full_name || 'Unnamed'}</div>
                                  <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={user.role === 'admin' ? 'destructive' : 'default'}
                                  className="capitalize"
                                >
                                  {user.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  {user.role === 'staff' && (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => assignRole(user.id, 'admin')}>
                                        <ShieldCheck className="h-4 w-4 mr-1" />
                                        Promote to Admin
                                      </Button>
                                      <Button size="sm" variant="secondary" onClick={() => assignRole(user.id, 'customer')}>
                                        <ShieldX className="h-4 w-4 mr-1" />
                                        Demote to Customer
                                      </Button>
                                    </>
                                  )}
                                  {user.role === 'admin' && (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => assignRole(user.id, 'staff')}>
                                        <UserCog className="h-4 w-4 mr-1" />
                                        Demote to Staff
                                      </Button>
                                      <Button size="sm" variant="secondary" onClick={() => assignRole(user.id, 'customer')}>
                                        <ShieldX className="h-4 w-4 mr-1" />
                                        Demote to Customer
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
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
                          <TableHead>Assigned Queues</TableHead>
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
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={staff.assigned_scan_types?.includes('full')}
                                    onChange={() => toggleStaffScanType(staff.id, 'full')}
                                    className="h-4 w-4 rounded border-input"
                                  />
                                  <span className="flex items-center gap-1">
                                    <Badge variant="default" className="text-xs">AI Scan</Badge>
                                  </span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={staff.assigned_scan_types?.includes('similarity_only')}
                                    onChange={() => toggleStaffScanType(staff.id, 'similarity_only')}
                                    className="h-4 w-4 rounded border-input"
                                  />
                                  <span className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-xs">Similarity</Badge>
                                  </span>
                                </label>
                              </div>
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

      {/* Credit Management Dialog */}
      <CreditManagementDialog
        user={creditDialogUser}
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
        onSuccess={fetchUsers}
      />

      {/* Pre-Register User Dialog */}
      <PreRegisterCreditDialog
        open={preRegisterOpen}
        onOpenChange={setPreRegisterOpen}
        onSuccess={fetchUsers}
      />
    </DashboardLayout>
  );
}
