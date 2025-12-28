import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, CreditCard, Clock, RefreshCw, Sparkles, Calendar, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PackageType = 'one_time' | 'subscription' | 'time_limited';
type BillingInterval = 'day' | 'week' | 'month' | 'year';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
  is_active: boolean;
  package_type: PackageType;
  billing_interval: BillingInterval | null;
  validity_days: number | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  name: string | null;
  description: string | null;
  features: string[];
}

const PACKAGE_TYPE_CONFIG = {
  one_time: {
    label: 'One-Time',
    icon: CreditCard,
    color: 'bg-blue-500',
    description: 'Single purchase credit packages',
  },
  subscription: {
    label: 'Subscription',
    icon: RefreshCw,
    color: 'bg-green-500',
    description: 'Recurring monthly/yearly plans',
  },
  time_limited: {
    label: 'Time-Limited',
    icon: Clock,
    color: 'bg-orange-500',
    description: 'Credits with expiration period',
  },
};

const BILLING_INTERVALS: { value: BillingInterval; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

export default function AdminPricing() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PricingPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<PackageType | 'all'>('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    credits: '',
    price: '',
    package_type: 'one_time' as PackageType,
    billing_interval: 'month' as BillingInterval,
    validity_days: '',
    stripe_price_id: '',
    stripe_product_id: '',
    description: '',
    features: '',
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pricing_packages')
      .select('*')
      .order('package_type', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch packages', variant: 'destructive' });
    } else {
      setPackages((data as PricingPackage[]) || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      credits: '',
      price: '',
      package_type: 'one_time',
      billing_interval: 'month',
      validity_days: '',
      stripe_price_id: '',
      stripe_product_id: '',
      description: '',
      features: '',
    });
    setEditingPackage(null);
  };

  const openEditDialog = (pkg: PricingPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name || '',
      credits: pkg.credits.toString(),
      price: pkg.price.toString(),
      package_type: pkg.package_type,
      billing_interval: pkg.billing_interval || 'month',
      validity_days: pkg.validity_days?.toString() || '',
      stripe_price_id: pkg.stripe_price_id || '',
      stripe_product_id: pkg.stripe_product_id || '',
      description: pkg.description || '',
      features: pkg.features?.join('\n') || '',
    });
    setDialogOpen(true);
  };

  const handleSavePackage = async () => {
    if (!formData.credits || !formData.price) {
      toast({ title: 'Error', description: 'Credits and price are required', variant: 'destructive' });
      return;
    }

    if (formData.package_type === 'subscription' && !formData.stripe_price_id) {
      toast({ title: 'Warning', description: 'Stripe Price ID recommended for subscriptions', variant: 'default' });
    }

    setSaving(true);
    
    const packageData = {
      name: formData.name || `${formData.credits} Credits`,
      credits: parseInt(formData.credits),
      price: parseFloat(formData.price),
      package_type: formData.package_type,
      billing_interval: formData.package_type === 'subscription' ? formData.billing_interval : null,
      validity_days: formData.package_type === 'time_limited' ? parseInt(formData.validity_days) || null : null,
      stripe_price_id: formData.stripe_price_id || null,
      stripe_product_id: formData.stripe_product_id || null,
      description: formData.description || null,
      features: formData.features.split('\n').filter(f => f.trim()),
    };

    let error;
    if (editingPackage) {
      const { error: updateError } = await supabase
        .from('pricing_packages')
        .update(packageData)
        .eq('id', editingPackage.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('pricing_packages')
        .insert(packageData);
      error = insertError;
    }

    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to save package', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: editingPackage ? 'Package updated' : 'Package created' });
      resetForm();
      setDialogOpen(false);
      fetchPackages();
    }
    setSaving(false);
  };

  const handleToggleActive = async (pkg: PricingPackage) => {
    const { error } = await supabase
      .from('pricing_packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update package', variant: 'destructive' });
    } else {
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

  const filteredPackages = activeTab === 'all' 
    ? packages 
    : packages.filter(p => p.package_type === activeTab);

  const getPackageCounts = () => {
    return {
      all: packages.length,
      one_time: packages.filter(p => p.package_type === 'one_time').length,
      subscription: packages.filter(p => p.package_type === 'subscription').length,
      time_limited: packages.filter(p => p.package_type === 'time_limited').length,
    };
  };

  const counts = getPackageCounts();

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
            <p className="text-muted-foreground mt-1">Manage credit packages, subscriptions, and time-limited offers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPackage ? 'Edit Package' : 'Create New Package'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Package Type Selection */}
                <div className="space-y-3">
                  <Label>Package Type</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(PACKAGE_TYPE_CONFIG) as PackageType[]).map((type) => {
                      const config = PACKAGE_TYPE_CONFIG[type];
                      const Icon = config.icon;
                      const isSelected = formData.package_type === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, package_type: type }))}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-muted-foreground/50'
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-lg ${config.color} flex items-center justify-center mb-2`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <p className="font-medium text-sm">{config.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Package Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Starter Pack, Pro Monthly"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Credits</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.credits}
                      onChange={(e) => setFormData(prev => ({ ...prev, credits: e.target.value }))}
                      placeholder="e.g., 10"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Price ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="e.g., 15.00"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Subscription-specific fields */}
                {formData.package_type === 'subscription' && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <RefreshCw className="h-4 w-4" />
                      Subscription Settings
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Billing Interval</Label>
                        <Select
                          value={formData.billing_interval}
                          onValueChange={(value: BillingInterval) => 
                            setFormData(prev => ({ ...prev, billing_interval: value }))
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_INTERVALS.map(interval => (
                              <SelectItem key={interval.value} value={interval.value}>
                                {interval.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Stripe Price ID</Label>
                        <Input
                          value={formData.stripe_price_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, stripe_price_id: e.target.value }))}
                          placeholder="price_..."
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Stripe Product ID</Label>
                      <Input
                        value={formData.stripe_product_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, stripe_product_id: e.target.value }))}
                        placeholder="prod_..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* Time-limited specific fields */}
                {formData.package_type === 'time_limited' && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                      <Clock className="h-4 w-4" />
                      Time-Limited Settings
                    </div>
                    <div>
                      <Label>Validity Period (Days)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.validity_days}
                        onChange={(e) => setFormData(prev => ({ ...prev, validity_days: e.target.value }))}
                        placeholder="e.g., 30"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Credits will expire after this many days from purchase
                      </p>
                    </div>
                  </div>
                )}

                {/* One-time specific fields */}
                {formData.package_type === 'one_time' && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <CreditCard className="h-4 w-4" />
                      One-Time Purchase Settings
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Stripe Price ID (Optional)</Label>
                        <Input
                          value={formData.stripe_price_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, stripe_price_id: e.target.value }))}
                          placeholder="price_..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Stripe Product ID (Optional)</Label>
                        <Input
                          value={formData.stripe_product_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, stripe_product_id: e.target.value }))}
                          placeholder="prod_..."
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Description & Features */}
                <div className="space-y-4">
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of this package..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Features (one per line)</Label>
                    <Textarea
                      value={formData.features}
                      onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                      placeholder="Priority support&#10;Fast processing&#10;24/7 availability"
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={handleSavePackage} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Package Type Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PackageType | 'all')}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="gap-2">
              All <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="one_time" className="gap-2">
              <CreditCard className="h-4 w-4" /> One-Time 
              <Badge variant="secondary" className="ml-1">{counts.one_time}</Badge>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Subscription 
              <Badge variant="secondary" className="ml-1">{counts.subscription}</Badge>
            </TabsTrigger>
            <TabsTrigger value="time_limited" className="gap-2">
              <Clock className="h-4 w-4" /> Time-Limited 
              <Badge variant="secondary" className="ml-1">{counts.time_limited}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Package Cards */}
        {filteredPackages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No packages found in this category</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create First Package
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPackages.map((pkg) => {
              const typeConfig = PACKAGE_TYPE_CONFIG[pkg.package_type];
              const TypeIcon = typeConfig.icon;
              return (
                <Card key={pkg.id} className={`relative ${!pkg.is_active ? 'opacity-60' : ''}`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 ${typeConfig.color} rounded-t-lg`} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-10 w-10 rounded-lg ${typeConfig.color} flex items-center justify-center`}>
                          <TypeIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{pkg.name || `${pkg.credits} Credits`}</CardTitle>
                          <Badge variant="outline" className="text-xs mt-1">
                            {typeConfig.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(pkg)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={pkg.is_active}
                          onCheckedChange={() => handleToggleActive(pkg)}
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
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">${pkg.price}</span>
                      {pkg.package_type === 'subscription' && pkg.billing_interval && (
                        <span className="text-muted-foreground">/{pkg.billing_interval}</span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Credits</span>
                        <span className="font-medium">{pkg.credits}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Per Credit</span>
                        <span className="font-medium">${(pkg.price / pkg.credits).toFixed(2)}</span>
                      </div>
                      {pkg.package_type === 'time_limited' && pkg.validity_days && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Valid For</span>
                          <span className="font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {pkg.validity_days} days
                          </span>
                        </div>
                      )}
                      {pkg.stripe_price_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Stripe</span>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {pkg.stripe_price_id.slice(0, 15)}...
                          </Badge>
                        </div>
                      )}
                    </div>

                    {pkg.features && pkg.features.length > 0 && (
                      <div className="pt-3 border-t space-y-1">
                        {pkg.features.slice(0, 3).map((feature, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Sparkles className="h-3 w-3 text-primary" />
                            {feature}
                          </div>
                        ))}
                        {pkg.features.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{pkg.features.length - 3} more</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
