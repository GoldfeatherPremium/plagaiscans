import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Loader2, Receipt, Calendar, DollarSign, Plus, Search, Users, Globe, Shield, CalendarIcon, Trash2, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  amount_usd: number;
  credits: number;
  status: string;
  payment_type: string;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_country: string | null;
  currency: string | null;
  transaction_id: string | null;
  vat_rate: number | null;
  vat_amount: number | null;
  is_immutable: boolean | null;
  created_at: string;
  paid_at: string | null;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state for creating invoice
  const [formData, setFormData] = useState({
    user_id: '',
    amount_usd: '',
    credits: '',
    description: '',
    notes: '',
    status: 'paid',
    currency: 'USD',
    customer_country: '',
    transaction_id: ''
  });
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    fetchInvoices();
    fetchUsers();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive"
      });
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .order('email');

    if (!error && data) {
      setUsers(data);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoiceId: invoice.id }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate invoice');

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast({
        title: "Success",
        description: "Invoice opened for printing/download"
      });
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to download invoice",
        variant: "destructive"
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateInvoice = async () => {
    if (!formData.user_id || !formData.amount_usd || !formData.credits) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice', {
        body: {
          user_id: formData.user_id,
          amount_usd: parseFloat(formData.amount_usd),
          credits: parseInt(formData.credits),
          payment_type: 'manual',
          description: formData.description || 'Plagiarism & AI Content Analysis Service',
          notes: formData.notes || undefined,
          status: formData.status,
          currency: formData.currency,
          customer_country: formData.customer_country || undefined,
          transaction_id: formData.transaction_id || undefined,
          invoice_date: invoiceDate?.toISOString(),
          payment_date: formData.status === 'paid' ? paymentDate?.toISOString() : undefined
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to create invoice');

      toast({
        title: "Success",
        description: `Invoice ${data.invoice.invoice_number} created successfully`
      });

      setCreateDialogOpen(false);
      setFormData({
        user_id: '',
        amount_usd: '',
        credits: '',
        description: '',
        notes: '',
        status: 'paid',
        currency: 'USD',
        customer_country: '',
        transaction_id: ''
      });
      setInvoiceDate(new Date());
      setPaymentDate(new Date());
      fetchInvoices();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmMessage = invoice.is_immutable 
      ? `⚠️ WARNING: Invoice ${invoice.invoice_number} is LOCKED. Are you absolutely sure you want to delete it? Type "DELETE" to confirm.`
      : `Delete invoice ${invoice.invoice_number}? This action cannot be undone.`;

    if (invoice.is_immutable) {
      const userInput = prompt(confirmMessage);
      if (userInput !== 'DELETE') {
        toast({
          title: "Cancelled",
          description: "Invoice deletion cancelled.",
        });
        return;
      }
    } else {
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    setDeletingId(invoice.id);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `Invoice ${invoice.invoice_number} has been deleted.`
      });
      
      fetchInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (invoiceId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(invoiceId);
    } else {
      newSelected.delete(invoiceId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const hasImmutable = invoices.filter(inv => selectedIds.has(inv.id)).some(inv => inv.is_immutable);
    
    const confirmMessage = hasImmutable 
      ? `⚠️ WARNING: You are about to delete ${selectedIds.size} invoice(s), some of which are LOCKED. Type "DELETE ALL" to confirm.`
      : `Delete ${selectedIds.size} invoice(s)? This action cannot be undone.`;

    if (hasImmutable) {
      const userInput = prompt(confirmMessage);
      if (userInput !== 'DELETE ALL') {
        toast({
          title: "Cancelled",
          description: "Bulk deletion cancelled.",
        });
        return;
      }
    } else {
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `${selectedIds.size} invoice(s) have been deleted.`
      });
      
      setSelectedIds(new Set());
      fetchInvoices();
    } catch (error: any) {
      console.error('Error bulk deleting invoices:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoices",
        variant: "destructive"
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      stripe: 'bg-purple-500/10 text-purple-500',
      crypto: 'bg-orange-500/10 text-orange-500',
      manual: 'bg-blue-500/10 text-blue-500',
      usdt_trc20: 'bg-teal-500/10 text-teal-500',
      custom: 'bg-gray-500/10 text-gray-500'
    };
    return (
      <Badge className={`${colors[type] || colors.custom} border-transparent`}>
        {type === 'usdt_trc20' ? 'USDT' : type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const getCurrencySymbol = (currency: string | null) => {
    const symbols: Record<string, string> = {
      USD: '$', GBP: '£', EUR: '€', AED: 'د.إ', INR: '₹', 
      CAD: 'C$', AUD: 'A$', SGD: 'S$', CHF: 'Fr', JPY: '¥', CNY: '¥'
    };
    return symbols[currency || 'USD'] || '$';
  };

  const filteredInvoices = invoices.filter(invoice => {
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.customer_email?.toLowerCase().includes(query) ||
      invoice.customer_name?.toLowerCase().includes(query) ||
      invoice.transaction_id?.toLowerCase().includes(query)
    );
  });

  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount_usd), 0);

  const thisMonthInvoices = invoices.filter(inv => {
    const invoiceDate = new Date(inv.created_at);
    const now = new Date();
    return invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear();
  });

  const immutableCount = invoices.filter(inv => inv.is_immutable).length;

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
            <h1 className="text-3xl font-display font-bold">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Manage and create UK-compliant customer invoices
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>
                  Create a legally compliant invoice for Plagaiscans Technologies Ltd
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="user">Customer *</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount_usd}
                      onChange={(e) => setFormData({ ...formData, amount_usd: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="AED">AED (د.إ)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="CAD">CAD ($)</SelectItem>
                        <SelectItem value="AUD">AUD ($)</SelectItem>
                        <SelectItem value="SGD">SGD ($)</SelectItem>
                        <SelectItem value="CHF">CHF (Fr)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="CNY">CNY (¥)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="credits">Credits *</Label>
                    <Input
                      id="credits"
                      type="number"
                      placeholder="0"
                      value={formData.credits}
                      onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Invoice Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !invoiceDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {invoiceDate ? format(invoiceDate, "dd MMM yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={invoiceDate}
                          onSelect={setInvoiceDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label>Payment Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !paymentDate && "text-muted-foreground"
                          )}
                          disabled={formData.status !== 'paid'}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {paymentDate ? format(paymentDate, "dd MMM yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={paymentDate}
                          onSelect={setPaymentDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Customer Country</Label>
                    <Input
                      id="country"
                      placeholder="e.g., United Kingdom"
                      value={formData.customer_country}
                      onChange={(e) => setFormData({ ...formData, customer_country: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="description">Service Description</Label>
                    <Input
                      id="description"
                      placeholder="Plagiarism & AI Content Analysis Service"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="transaction_id">Transaction/Reference ID</Label>
                    <Input
                      id="transaction_id"
                      placeholder="e.g., TXN-12345 or payment reference"
                      value={formData.transaction_id}
                      onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes (not shown to customer)..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateInvoice} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Invoice'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">{thisMonthInvoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold">
                    {new Set(invoices.map(inv => inv.user_id)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Locked</p>
                  <p className="text-2xl font-bold">{immutableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Invoices</CardTitle>
                <CardDescription>UK-compliant invoices for Goldfeather Prem Ltd (Trading as Plagaiscans)</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="gap-2"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete {selectedIds.size} Selected
                  </Button>
                )}
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices, emails, transactions..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No invoices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className={selectedIds.has(invoice.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onCheckedChange={(checked) => handleSelectOne(invoice.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-medium">{invoice.invoice_number}</code>
                            {invoice.is_immutable && (
                              <span title="Locked invoice"><Shield className="h-3 w-3 text-amber-500" /></span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {invoice.customer_name || 'Guest Customer'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.customer_email || '-'}
                            </p>
                            {invoice.customer_country && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {invoice.customer_country}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getPaymentTypeBadge(invoice.payment_type)}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          +{invoice.credits}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getCurrencySymbol(invoice.currency)}{Number(invoice.amount_usd).toFixed(2)}
                          <span className="text-xs text-muted-foreground ml-1">{invoice.currency || 'USD'}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                              disabled={downloadingId === invoice.id}
                              className="gap-1"
                            >
                              {downloadingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteInvoice(invoice)}
                              disabled={deletingId === invoice.id}
                              className={cn("text-destructive hover:text-destructive", invoice.is_immutable && "opacity-70")}
                              title={invoice.is_immutable ? "Click to force delete locked invoice" : "Delete invoice"}
                            >
                              {deletingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center">
              All invoices are generated for <strong>Goldfeather Prem Ltd</strong> (Company Number: XXXXXXX), 
              trading as <strong>Plagaiscans</strong>, registered in the United Kingdom. 
              Paid invoices are immutable and cannot be edited for audit compliance.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
