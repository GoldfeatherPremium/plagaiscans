import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, User, Mail, Phone, CreditCard, Calendar, History, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
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

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  credit_balance: number;
  created_at: string;
}

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_type: string;
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

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setUsers(data);
    setLoading(false);
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

  const updateCredits = async (userId: string, amount: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    
    const newBalance = user.credit_balance + amount;
    if (newBalance < 0) {
      toast({ title: 'Error', description: 'Balance cannot be negative', variant: 'destructive' });
      return;
    }

    // Get current user for audit
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // Update balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credit_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      toast({ title: 'Error', description: 'Failed to update credits', variant: 'destructive' });
      return;
    }

    // Log transaction
    const { error: logError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        balance_before: user.credit_balance,
        balance_after: newBalance,
        transaction_type: amount > 0 ? 'add' : 'deduct',
        description: amount > 0 ? 'Credits added by admin' : 'Credits deducted by admin',
        performed_by: currentUser?.id
      });

    if (logError) {
      console.error('Failed to log transaction:', logError);
    }

    toast({ title: 'Success', description: 'Credits updated' });
    fetchUsers();
    setCreditInputs({ ...creditInputs, [userId]: '' });
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
      
      // Calculate stats
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
          <p className="text-muted-foreground mt-1">Manage customer accounts, credits & view audit history</p>
        </div>

        {/* Search Bar */}
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
                          Credits
                        </div>
                      </TableHead>
                      <TableHead className="text-center">History</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
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
                          {user.phone || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold text-primary">{user.credit_balance}</span>
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
                            <Button
                              size="sm"
                              onClick={() => updateCredits(user.id, parseInt(creditInputs[user.id]) || 0)}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateCredits(user.id, -(parseInt(creditInputs[user.id]) || 0))
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
              {/* Stats Cards */}
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

              {/* Transaction History */}
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