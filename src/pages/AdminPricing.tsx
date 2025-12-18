import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, DollarSign, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
  is_active: boolean;
}

export default function AdminPricing() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCredits, setNewCredits] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pricing_packages')
      .select('*')
      .order('credits', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch packages', variant: 'destructive' });
    } else {
      setPackages(data || []);
    }
    setLoading(false);
  };

  const handleAddPackage = async () => {
    if (!newCredits || !newPrice) return;
    
    setSaving(true);
    const { error } = await supabase.from('pricing_packages').insert({
      credits: parseInt(newCredits),
      price: parseFloat(newPrice),
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to add package', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Package added successfully' });
      setNewCredits('');
      setNewPrice('');
      setDialogOpen(false);
      fetchPackages();
    }
    setSaving(false);
  };

  const handleUpdatePackage = async (pkg: PricingPackage, updates: Partial<PricingPackage>) => {
    const { error } = await supabase
      .from('pricing_packages')
      .update(updates)
      .eq('id', pkg.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update package', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Package updated' });
      fetchPackages();
    }
  };

  const handleDeletePackage = async (id: string) => {
    const { error } = await supabase.from('pricing_packages').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete package', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Package deleted' });
      fetchPackages();
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Pricing Management</h1>
            <p className="text-muted-foreground mt-1">Manage credit packages and pricing</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Package
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Package</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Credits</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newCredits}
                    onChange={(e) => setNewCredits(e.target.value)}
                    placeholder="e.g., 10"
                  />
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="e.g., 15.00"
                  />
                </div>
                <Button className="w-full" onClick={handleAddPackage} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Package'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={pkg.is_active}
                      onCheckedChange={(checked) => handleUpdatePackage(pkg, { is_active: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeletePackage(pkg.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Credits</Label>
                    <Input
                      type="number"
                      value={pkg.credits}
                      onChange={(e) => handleUpdatePackage(pkg, { credits: parseInt(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pkg.price}
                      onChange={(e) => handleUpdatePackage(pkg, { price: parseFloat(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      ${(pkg.price / pkg.credits).toFixed(2)} per document
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
