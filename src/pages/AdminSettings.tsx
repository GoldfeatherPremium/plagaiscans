import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Save, Loader2, UserPlus, Clock, Users, Settings2, CreditCard, Bitcoin, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  time_limit_minutes: number;
  max_concurrent_files: number;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [processingTimeout, setProcessingTimeout] = useState('30');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [usdtEnabled, setUsdtEnabled] = useState(true);
  const [binanceEnabled, setBinanceEnabled] = useState(false);
  const [binancePayId, setBinancePayId] = useState('');
  const [savingBinance, setSavingBinance] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'customer'>('staff');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchUsers();
    fetchStaffWithSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').in('key', [
      'whatsapp_number', 
      'processing_timeout_minutes',
      'payment_whatsapp_enabled',
      'payment_usdt_enabled',
      'payment_binance_enabled',
      'binance_pay_id'
    ]);
    if (data) {
      const whatsapp = data.find(s => s.key === 'whatsapp_number');
      const timeout = data.find(s => s.key === 'processing_timeout_minutes');
      const whatsappPayment = data.find(s => s.key === 'payment_whatsapp_enabled');
      const usdtPayment = data.find(s => s.key === 'payment_usdt_enabled');
      const binancePayment = data.find(s => s.key === 'payment_binance_enabled');
      const binanceId = data.find(s => s.key === 'binance_pay_id');
      if (whatsapp) setWhatsappNumber(whatsapp.value);
      if (timeout) setProcessingTimeout(timeout.value);
      setWhatsappEnabled(whatsappPayment?.value !== 'false');
      setUsdtEnabled(usdtPayment?.value !== 'false');
      setBinanceEnabled(binancePayment?.value === 'true');
      if (binanceId) setBinancePayId(binanceId.value);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, email, full_name');
    if (data) setUsers(data);
  };

  const fetchStaffWithSettings = async () => {
    // Get all staff members
    const { data: staffRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'staff');

    if (!staffRoles || staffRoles.length === 0) {
      setStaffMembers([]);
      return;
    }

    const staffIds = staffRoles.map(r => r.user_id);

    // Get profiles for staff
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', staffIds);

    // Get staff settings
    const { data: settings } = await supabase
      .from('staff_settings')
      .select('*')
      .in('user_id', staffIds);

    // Merge data
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

  const saveWhatsAppNumber = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').update({ value: whatsappNumber }).eq('key', 'whatsapp_number');
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'WhatsApp number updated' });
    }
  };

  const saveProcessingTimeout = async () => {
    setSavingTimeout(true);
    const { error } = await supabase.from('settings').update({ value: processingTimeout }).eq('key', 'processing_timeout_minutes');
    setSavingTimeout(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save timeout setting', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Global processing timeout updated' });
    }
  };

  const savePaymentMethods = async () => {
    setSavingPaymentMethods(true);
    
    // Upsert all payment settings
    const { error: error1 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_whatsapp_enabled', value: whatsappEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error2 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_usdt_enabled', value: usdtEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error3 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_binance_enabled', value: binanceEnabled.toString() }, { onConflict: 'key' });
    
    setSavingPaymentMethods(false);
    
    if (error1 || error2 || error3) {
      toast({ title: 'Error', description: 'Failed to save payment settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment methods updated' });
    }
  };

  const saveBinanceSettings = async () => {
    setSavingBinance(true);
    
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'binance_pay_id', value: binancePayId }, { onConflict: 'key' });
    
    setSavingBinance(false);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to save Binance Pay ID', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Binance Pay ID updated' });
    }
  };

  const assignRole = async () => {
    if (!selectedUser || !selectedRole) return;

    // First delete existing role
    await supabase.from('user_roles').delete().eq('user_id', selectedUser);

    // Then insert new role
    const { error } = await supabase.from('user_roles').insert({ user_id: selectedUser, role: selectedRole });

    if (error) {
      toast({ title: 'Error', description: 'Failed to assign role', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Role assigned: ${selectedRole}` });
      setSelectedUser('');
      // Refresh staff list if role changed
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
    
    // Upsert staff settings
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage platform settings</p>
        </div>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Methods
            </CardTitle>
            <CardDescription>Enable or disable payment options for customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp Payment</p>
                  <p className="text-sm text-muted-foreground">Manual payment via WhatsApp</p>
                </div>
              </div>
              <Switch
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bitcoin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">USDT Payment (TRC20)</p>
                  <p className="text-sm text-muted-foreground">Crypto payment via NOWPayments (min. $15)</p>
                </div>
              </div>
              <Switch
                checked={usdtEnabled}
                onCheckedChange={setUsdtEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-[#F0B90B]" />
                </div>
                <div>
                  <p className="font-medium">Binance Pay</p>
                  <p className="text-sm text-muted-foreground">Manual payment with admin verification</p>
                </div>
              </div>
              <Switch
                checked={binanceEnabled}
                onCheckedChange={setBinanceEnabled}
              />
            </div>
            <Button onClick={savePaymentMethods} disabled={savingPaymentMethods}>
              {savingPaymentMethods ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Payment Settings
            </Button>
          </CardContent>
        </Card>

        {/* Binance Pay Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#F0B90B]" />
              Binance Pay Configuration
            </CardTitle>
            <CardDescription>Configure your Binance Pay ID for manual payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="binancePay">Binance Pay ID</Label>
              <Input
                id="binancePay"
                placeholder="Enter your Binance Pay ID"
                value={binancePayId}
                onChange={(e) => setBinancePayId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Customers will send payments to this Binance Pay ID
              </p>
            </div>
            <Button onClick={saveBinanceSettings} disabled={savingBinance}>
              {savingBinance ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Binance Settings
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              WhatsApp Configuration
            </CardTitle>
            <CardDescription>Configure the WhatsApp number for credit purchases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                placeholder="+1234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US, +44 for UK)
              </p>
            </div>
            <Button onClick={saveWhatsAppNumber} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Global Processing Timeout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Global Document Processing Timeout
            </CardTitle>
            <CardDescription>Default timeout for staff without individual settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Default Timeout (minutes)</Label>
              <Input
                id="timeout"
                type="number"
                min="5"
                max="1440"
                placeholder="30"
                value={processingTimeout}
                onChange={(e) => setProcessingTimeout(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used as fallback when staff has no individual timeout set (5-1440 minutes)
              </p>
            </div>
            <Button onClick={saveProcessingTimeout} disabled={savingTimeout}>
              {savingTimeout ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Default Timeout
            </Button>
          </CardContent>
        </Card>

        {/* Staff Individual Limits */}
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
                <p>No staff members found. Assign staff roles below.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead className="w-36">Time Limit (min)</TableHead>
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

        {/* Role Assignment */}
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
              <Select value={selectedUser} onValueChange={setSelectedUser}>
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
            <Button onClick={assignRole} disabled={!selectedUser}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Role
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}