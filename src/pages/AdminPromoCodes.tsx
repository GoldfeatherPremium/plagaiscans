import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plus, 
  Ticket, 
  Trash2, 
  Copy, 
  Check,
  Calendar,
  Users,
  Percent,
  Coins
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { format } from 'date-fns';

interface PromoCode {
  id: string;
  code: string;
  credits_bonus: number;
  discount_percentage: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPromoCodes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newCode, setNewCode] = useState({
    code: '',
    credits_bonus: 0,
    discount_percentage: 0,
    max_uses: '',
    valid_until: '',
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!error && data) {
      setPromoCodes(data);
    }
    setLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode({ ...newCode, code });
  };

  const createPromoCode = async () => {
    if (!newCode.code.trim()) {
      toast({ title: 'Error', description: 'Please enter a code', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('promo_codes').insert({
      code: newCode.code.toUpperCase().trim(),
      credits_bonus: newCode.credits_bonus || 0,
      discount_percentage: newCode.discount_percentage || 0,
      max_uses: newCode.max_uses ? parseInt(newCode.max_uses) : null,
      valid_until: newCode.valid_until || null,
      created_by: user?.id,
    });

    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Promo code created' });
      setDialogOpen(false);
      setNewCode({ code: '', credits_bonus: 0, discount_percentage: 0, max_uses: '', valid_until: '' });
      fetchPromoCodes();
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !currentState })
      .eq('id', id);

    if (!error) {
      setPromoCodes(promoCodes.map(p => p.id === id ? { ...p, is_active: !currentState } : p));
    }
  };

  const deletePromoCode = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Promo code removed' });
      setPromoCodes(promoCodes.filter(p => p.id !== id));
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Promo Codes</h1>
            <p className="text-muted-foreground mt-1">Create and manage discount codes for credits</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Promo Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="SUMMER2024"
                      value={newCode.code}
                      onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                    />
                    <Button variant="outline" onClick={generateCode}>Generate</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bonus Credits</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newCode.credits_bonus || ''}
                      onChange={(e) => setNewCode({ ...newCode, credits_bonus: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      max="100"
                      value={newCode.discount_percentage || ''}
                      onChange={(e) => setNewCode({ ...newCode, discount_percentage: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Uses (empty = unlimited)</Label>
                    <Input
                      type="number"
                      placeholder="Unlimited"
                      value={newCode.max_uses}
                      onChange={(e) => setNewCode({ ...newCode, max_uses: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid Until (optional)</Label>
                    <Input
                      type="date"
                      value={newCode.valid_until}
                      onChange={(e) => setNewCode({ ...newCode, valid_until: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={createPromoCode} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Promo Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Codes</p>
                <p className="text-xl font-bold">{promoCodes.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Codes</p>
                <p className="text-xl font-bold">{promoCodes.filter(p => p.is_active).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Uses</p>
                <p className="text-xl font-bold">{promoCodes.reduce((sum, p) => sum + p.current_uses, 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Promo Codes Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : promoCodes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No promo codes yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first promo code above</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promoCodes.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                              {promo.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(promo.code, promo.id)}
                            >
                              {copiedId === promo.id ? (
                                <Check className="h-3 w-3 text-secondary" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {promo.credits_bonus > 0 && (
                            <div className="flex items-center gap-1 text-secondary">
                              <Coins className="h-4 w-4" />
                              +{promo.credits_bonus}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {promo.discount_percentage > 0 && (
                            <div className="flex items-center gap-1 text-primary">
                              <Percent className="h-4 w-4" />
                              {promo.discount_percentage}%
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">
                            {promo.current_uses}{promo.max_uses ? ` / ${promo.max_uses}` : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          {promo.valid_until ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(promo.valid_until), 'MMM dd, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isExpired(promo.valid_until) ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : promo.is_active ? (
                            <Badge variant="default" className="bg-secondary">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={promo.is_active}
                              onCheckedChange={() => toggleActive(promo.id, promo.is_active)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deletePromoCode(promo.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
      </div>
    </DashboardLayout>
  );
}
