import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, Download, Loader2, Plus, Trash2, Edit, Calendar as CalendarIcon, 
  Building2, Upload, RefreshCw, DollarSign, TrendingUp, TrendingDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BankStatement {
  id: string;
  statement_number: string;
  bank_name: string;
  bank_country: string;
  bank_logo_url: string | null;
  account_name: string;
  account_number: string | null;
  sort_code: string | null;
  iban: string | null;
  swift_code: string | null;
  statement_date: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_credits: number;
  total_debits: number;
  currency: string;
  notes: string | null;
  created_at: string;
}

interface StatementEntry {
  id: string;
  statement_id: string;
  entry_date: string;
  description: string;
  reference: string | null;
  entry_type: string;
  amount: number;
  running_balance: number | null;
  invoice_id: string | null;
  receipt_id: string | null;
  is_manual: boolean;
}

export default function AdminBankStatements() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [entriesDialogOpen, setEntriesDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [formData, setFormData] = useState({
    bank_name: 'Default Bank',
    bank_country: 'United Kingdom',
    bank_logo_url: '',
    account_name: 'Goldfeather Prem Ltd',
    account_number: '',
    sort_code: '',
    iban: '',
    swift_code: '',
    opening_balance: '0',
    currency: 'GBP',
    notes: ''
  });
  const [periodStart, setPeriodStart] = useState<Date>();
  const [periodEnd, setPeriodEnd] = useState<Date>();

  // Manual entry form
  const [manualEntry, setManualEntry] = useState({
    entry_date: new Date(),
    description: '',
    reference: '',
    entry_type: 'credit',
    amount: ''
  });

  useEffect(() => {
    fetchStatements();
  }, []);

  const fetchStatements = async () => {
    const { data, error } = await supabase
      .from('bank_statements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load statements", variant: "destructive" });
    } else {
      setStatements(data || []);
    }
    setLoading(false);
  };

  const fetchEntries = async (statementId: string) => {
    setLoadingEntries(true);
    const { data, error } = await supabase
      .from('bank_statement_entries')
      .select('*')
      .eq('statement_id', statementId)
      .order('entry_date', { ascending: true });

    if (!error) {
      setEntries(data || []);
    }
    setLoadingEntries(false);
  };

  const handleCreateStatement = async () => {
    if (!periodStart || !periodEnd) {
      toast({ title: "Error", description: "Please select statement period", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const { data: stmt, error } = await supabase
        .from('bank_statements')
        .insert({
          bank_name: formData.bank_name,
          bank_country: formData.bank_country,
          bank_logo_url: formData.bank_logo_url || null,
          account_name: formData.account_name,
          account_number: formData.account_number || null,
          sort_code: formData.sort_code || null,
          iban: formData.iban || null,
          swift_code: formData.swift_code || null,
          period_start: format(periodStart, 'yyyy-MM-dd'),
          period_end: format(periodEnd, 'yyyy-MM-dd'),
          opening_balance: parseFloat(formData.opening_balance) || 0,
          currency: formData.currency,
          notes: formData.notes || null,
          statement_number: ''
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Success", description: `Statement ${stmt.statement_number} created` });
      setCreateDialogOpen(false);
      resetForm();
      fetchStatements();

      // Auto-sync with invoices/receipts
      if (stmt) {
        await syncStatementWithPayments(stmt.id, periodStart, periodEnd);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const syncStatementWithPayments = async (statementId: string, start: Date, end: Date) => {
    setSyncing(true);
    try {
      // Fetch invoices in date range
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', format(start, 'yyyy-MM-dd'))
        .lte('created_at', format(end, 'yyyy-MM-dd') + 'T23:59:59')
        .eq('status', 'paid')
        .order('created_at', { ascending: true });

      // Fetch receipts in date range
      const { data: receipts } = await supabase
        .from('receipts')
        .select('*')
        .gte('receipt_date', format(start, 'yyyy-MM-dd'))
        .lte('receipt_date', format(end, 'yyyy-MM-dd') + 'T23:59:59')
        .order('receipt_date', { ascending: true });

      // Get statement for opening balance
      const { data: statement } = await supabase
        .from('bank_statements')
        .select('opening_balance, currency')
        .eq('id', statementId)
        .single();

      let runningBalance = statement?.opening_balance || 0;
      const entriesToInsert: any[] = [];
      let totalCredits = 0;
      let totalDebits = 0;

      // Add invoice entries (credits)
      invoices?.forEach(inv => {
        runningBalance += Number(inv.amount_usd);
        totalCredits += Number(inv.amount_usd);
        entriesToInsert.push({
          statement_id: statementId,
          entry_date: inv.paid_at || inv.created_at,
          description: `Payment - ${inv.customer_name || 'Customer'} - ${inv.credits} credits`,
          reference: inv.invoice_number,
          entry_type: 'credit',
          amount: inv.amount_usd,
          running_balance: runningBalance,
          invoice_id: inv.id,
          is_manual: false
        });
      });

      // Insert entries
      if (entriesToInsert.length > 0) {
        await supabase.from('bank_statement_entries').insert(entriesToInsert);
      }

      // Update statement totals
      await supabase
        .from('bank_statements')
        .update({
          total_credits: totalCredits,
          total_debits: totalDebits,
          closing_balance: (statement?.opening_balance || 0) + totalCredits - totalDebits
        })
        .eq('id', statementId);

      toast({ title: "Synced", description: `Added ${entriesToInsert.length} transactions from invoices` });
      fetchStatements();
    } catch (error: any) {
      toast({ title: "Sync Error", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateStatement = async () => {
    if (!selectedStatement) return;

    try {
      const { error } = await supabase
        .from('bank_statements')
        .update({
          bank_name: formData.bank_name,
          bank_country: formData.bank_country,
          bank_logo_url: formData.bank_logo_url || null,
          account_name: formData.account_name,
          account_number: formData.account_number || null,
          sort_code: formData.sort_code || null,
          iban: formData.iban || null,
          swift_code: formData.swift_code || null,
          opening_balance: parseFloat(formData.opening_balance) || 0,
          currency: formData.currency,
          notes: formData.notes || null
        })
        .eq('id', selectedStatement.id);

      if (error) throw error;

      toast({ title: "Success", description: "Statement updated" });
      setEditDialogOpen(false);
      fetchStatements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddManualEntry = async () => {
    if (!selectedStatement || !manualEntry.description || !manualEntry.amount) {
      toast({ title: "Error", description: "Fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      // Get current closing balance
      const lastEntry = entries[entries.length - 1];
      const currentBalance = lastEntry?.running_balance ?? selectedStatement.opening_balance;
      const amount = parseFloat(manualEntry.amount);
      const newBalance = manualEntry.entry_type === 'credit' 
        ? currentBalance + amount 
        : currentBalance - amount;

      await supabase.from('bank_statement_entries').insert({
        statement_id: selectedStatement.id,
        entry_date: format(manualEntry.entry_date, 'yyyy-MM-dd'),
        description: manualEntry.description,
        reference: manualEntry.reference || null,
        entry_type: manualEntry.entry_type,
        amount: amount,
        running_balance: newBalance,
        is_manual: true
      });

      // Update statement totals
      const newCredits = manualEntry.entry_type === 'credit' 
        ? selectedStatement.total_credits + amount 
        : selectedStatement.total_credits;
      const newDebits = manualEntry.entry_type === 'debit'
        ? selectedStatement.total_debits + amount
        : selectedStatement.total_debits;

      await supabase
        .from('bank_statements')
        .update({
          total_credits: newCredits,
          total_debits: newDebits,
          closing_balance: selectedStatement.opening_balance + newCredits - newDebits
        })
        .eq('id', selectedStatement.id);

      toast({ title: "Entry Added" });
      setManualEntry({ entry_date: new Date(), description: '', reference: '', entry_type: 'credit', amount: '' });
      fetchEntries(selectedStatement.id);
      fetchStatements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!selectedStatement) return;

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      await supabase.from('bank_statement_entries').delete().eq('id', entryId);

      // Recalculate totals
      const amount = entry.amount;
      const newCredits = entry.entry_type === 'credit'
        ? selectedStatement.total_credits - amount
        : selectedStatement.total_credits;
      const newDebits = entry.entry_type === 'debit'
        ? selectedStatement.total_debits - amount
        : selectedStatement.total_debits;

      await supabase
        .from('bank_statements')
        .update({
          total_credits: newCredits,
          total_debits: newDebits,
          closing_balance: selectedStatement.opening_balance + newCredits - newDebits
        })
        .eq('id', selectedStatement.id);

      toast({ title: "Entry Deleted" });
      fetchEntries(selectedStatement.id);
      fetchStatements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async (statement: BankStatement) => {
    setDownloadingId(statement.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bank-statement-pdf', {
        body: { statementId: statement.id }
      });

      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.onload = () => printWindow.print();
      }

      toast({ title: "Success", description: "Statement opened for printing" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteStatement = async (id: string) => {
    if (!confirm('Delete this statement and all its entries?')) return;

    try {
      await supabase.from('bank_statements').delete().eq('id', id);
      toast({ title: "Deleted" });
      fetchStatements();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      bank_name: 'Default Bank',
      bank_country: 'United Kingdom',
      bank_logo_url: '',
      account_name: 'Goldfeather Prem Ltd',
      account_number: '',
      sort_code: '',
      iban: '',
      swift_code: '',
      opening_balance: '0',
      currency: 'GBP',
      notes: ''
    });
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
  };

  const openEditDialog = (stmt: BankStatement) => {
    setSelectedStatement(stmt);
    setFormData({
      bank_name: stmt.bank_name,
      bank_country: stmt.bank_country,
      bank_logo_url: stmt.bank_logo_url || '',
      account_name: stmt.account_name,
      account_number: stmt.account_number || '',
      sort_code: stmt.sort_code || '',
      iban: stmt.iban || '',
      swift_code: stmt.swift_code || '',
      opening_balance: stmt.opening_balance.toString(),
      currency: stmt.currency,
      notes: stmt.notes || ''
    });
    setEditDialogOpen(true);
  };

  const openEntriesDialog = (stmt: BankStatement) => {
    setSelectedStatement(stmt);
    fetchEntries(stmt.id);
    setEntriesDialogOpen(true);
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
    return symbols[currency] || currency;
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
            <h1 className="text-3xl font-display font-bold">Bank Statements</h1>
            <p className="text-muted-foreground mt-1">Generate and manage bank statements synced with invoices/receipts</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Statement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Bank Statement</DialogTitle>
                <DialogDescription>Configure bank details and statement period</DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="bank" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="bank">Bank Details</TabsTrigger>
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="period">Period</TabsTrigger>
                </TabsList>
                <TabsContent value="bank" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Bank Name *</Label>
                      <Input
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="e.g., Barclays, HSBC"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Bank Country</Label>
                      <Input
                        value={formData.bank_country}
                        onChange={(e) => setFormData({ ...formData, bank_country: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Bank Logo URL</Label>
                      <Input
                        value={formData.bank_logo_url}
                        onChange={(e) => setFormData({ ...formData, bank_logo_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="account" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Account Name *</Label>
                      <Input
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Account Number</Label>
                        <Input
                          value={formData.account_number}
                          onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Sort Code</Label>
                        <Input
                          value={formData.sort_code}
                          onChange={(e) => setFormData({ ...formData, sort_code: e.target.value })}
                          placeholder="00-00-00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>IBAN</Label>
                        <Input
                          value={formData.iban}
                          onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>SWIFT/BIC</Label>
                        <Input
                          value={formData.swift_code}
                          onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="period" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Period Start *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("justify-start text-left", !periodStart && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {periodStart ? format(periodStart, "dd MMM yyyy") : "Select"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={periodStart} onSelect={setPeriodStart} className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="grid gap-2">
                        <Label>Period End *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("justify-start text-left", !periodEnd && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {periodEnd ? format(periodEnd, "dd MMM yyyy") : "Select"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={periodEnd} onSelect={setPeriodEnd} className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Opening Balance</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.opening_balance}
                          onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Currency</Label>
                        <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateStatement} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create & Sync
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Statements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statements.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                £{statements.reduce((sum, s) => sum + s.total_credits, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Debits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                £{statements.reduce((sum, s) => sum + s.total_debits, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                £{statements.reduce((sum, s) => sum + s.closing_balance, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statements Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Statements</CardTitle>
            <CardDescription>Click on a statement to view/edit entries</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statement #</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Debits</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => (
                  <TableRow key={stmt.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">{stmt.statement_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{stmt.bank_name}</div>
                          <div className="text-xs text-muted-foreground">{stmt.bank_country}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(stmt.period_start), 'dd MMM')} - {format(new Date(stmt.period_end), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {getCurrencySymbol(stmt.currency)}{stmt.opening_balance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      +{getCurrencySymbol(stmt.currency)}{stmt.total_credits.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      -{getCurrencySymbol(stmt.currency)}{stmt.total_debits.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {getCurrencySymbol(stmt.currency)}{stmt.closing_balance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEntriesDialog(stmt)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(stmt)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleDownloadPDF(stmt)}
                          disabled={downloadingId === stmt.id}
                        >
                          {downloadingId === stmt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteStatement(stmt.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {statements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No statements yet. Create your first statement to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Statement Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Statement</DialogTitle>
              <DialogDescription>Update bank and account details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Bank Name</Label>
                  <Input value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Bank Country</Label>
                  <Input value={formData.bank_country} onChange={(e) => setFormData({ ...formData, bank_country: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Bank Logo URL</Label>
                <Input value={formData.bank_logo_url} onChange={(e) => setFormData({ ...formData, bank_logo_url: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Account Name</Label>
                <Input value={formData.account_name} onChange={(e) => setFormData({ ...formData, account_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Account Number</Label>
                  <Input value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Sort Code</Label>
                  <Input value={formData.sort_code} onChange={(e) => setFormData({ ...formData, sort_code: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Opening Balance</Label>
                  <Input type="number" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateStatement}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Entries Dialog */}
        <Dialog open={entriesDialogOpen} onOpenChange={setEntriesDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Statement Entries - {selectedStatement?.statement_number}</DialogTitle>
              <DialogDescription>
                View and manage transactions. Add manual entries or sync from invoices.
              </DialogDescription>
            </DialogHeader>
            
            {/* Add Manual Entry */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3">Add Manual Entry</h4>
              <div className="grid grid-cols-5 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start">
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {format(manualEntry.entry_date, "dd/MM")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={manualEntry.entry_date} 
                      onSelect={(d) => d && setManualEntry({ ...manualEntry, entry_date: d })}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  placeholder="Description"
                  value={manualEntry.description}
                  onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                />
                <Input
                  placeholder="Reference"
                  value={manualEntry.reference}
                  onChange={(e) => setManualEntry({ ...manualEntry, reference: e.target.value })}
                />
                <div className="flex gap-2">
                  <Select value={manualEntry.entry_type} onValueChange={(v) => setManualEntry({ ...manualEntry, entry_type: v })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="debit">Debit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={manualEntry.amount}
                    onChange={(e) => setManualEntry({ ...manualEntry, amount: e.target.value })}
                    className="w-24"
                  />
                </div>
                <Button onClick={handleAddManualEntry} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Entries List */}
            <ScrollArea className="h-[400px]">
              {loadingEntries ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.description}
                            {entry.is_manual && <Badge variant="outline" className="text-xs">Manual</Badge>}
                            {entry.invoice_id && <Badge variant="secondary" className="text-xs">Invoice</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {entry.reference || '-'}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", entry.entry_type === 'credit' ? 'text-green-600' : 'text-red-600')}>
                          {entry.entry_type === 'credit' ? '+' : '-'}
                          {getCurrencySymbol(selectedStatement?.currency || 'GBP')}{entry.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {entry.running_balance !== null ? `${getCurrencySymbol(selectedStatement?.currency || 'GBP')}${entry.running_balance.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {entry.is_manual && (
                            <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => handleDeleteEntry(entry.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No entries yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEntriesDialogOpen(false)}>Close</Button>
              {selectedStatement && (
                <Button 
                  onClick={() => syncStatementWithPayments(selectedStatement.id, new Date(selectedStatement.period_start), new Date(selectedStatement.period_end))}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Re-sync Invoices
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
