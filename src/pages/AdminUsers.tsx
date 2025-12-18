import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, CreditCard, Loader2 } from 'lucide-react';

interface UserProfile { id: string; email: string; full_name: string | null; phone: string | null; credit_balance: number; }

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error && data) setUsers(data);
    setLoading(false);
  };

  const updateCredits = async (userId: string, amount: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const newBalance = user.credit_balance + amount;
    if (newBalance < 0) { toast({ title: 'Error', description: 'Balance cannot be negative', variant: 'destructive' }); return; }
    const { error } = await supabase.from('profiles').update({ credit_balance: newBalance }).eq('id', userId);
    if (error) { toast({ title: 'Error', description: 'Failed to update credits', variant: 'destructive' }); } 
    else { toast({ title: 'Success', description: 'Credits updated' }); fetchUsers(); setCreditInputs({ ...creditInputs, [userId]: '' }); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-bold">User Management</h1>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{user.full_name || 'No name'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{user.credit_balance}</p>
                      <p className="text-xs text-muted-foreground">Credits</p>
                    </div>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Amount" className="w-24" value={creditInputs[user.id] || ''} onChange={(e) => setCreditInputs({ ...creditInputs, [user.id]: e.target.value })} />
                      <Button size="sm" onClick={() => updateCredits(user.id, parseInt(creditInputs[user.id]) || 0)}>Add</Button>
                      <Button size="sm" variant="outline" onClick={() => updateCredits(user.id, -(parseInt(creditInputs[user.id]) || 0))}>Deduct</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}