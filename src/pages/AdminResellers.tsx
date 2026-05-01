import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, Trash2, RotateCw } from "lucide-react";

interface Reseller {
  id: string;
  name: string;
  contact_email: string | null;
  status: string;
  credit_balance: number;
  total_credits_purchased: number;
  total_credits_used: number;
  webhook_url: string | null;
  rate_limit_per_min: number;
  created_at: string;
}

export default function AdminResellers() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Reseller | null>(null);

  const [form, setForm] = useState({ name: "", contact_email: "", webhook_url: "" });
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("resellers").select("*").order("created_at", { ascending: false });
    setResellers((data ?? []) as Reseller[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createReseller = async () => {
    if (!form.name) return toast.error("Name required");
    const { data, error } = await supabase.from("resellers").insert({
      name: form.name,
      contact_email: form.contact_email || null,
      webhook_url: form.webhook_url || null,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Reseller created");
    setCreateOpen(false);
    setForm({ name: "", contact_email: "", webhook_url: "" });
    setSelected(data as Reseller);
    load();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Resellers</h1>
            <p className="text-sm text-muted-foreground">Manage API resellers, credits, and webhooks.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Reseller</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow> :
                  resellers.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No resellers yet</TableCell></TableRow> :
                  resellers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.contact_email ?? "—"}</TableCell>
                      <TableCell><Badge variant={r.status === "active" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                      <TableCell>{r.credit_balance}</TableCell>
                      <TableCell>{r.total_credits_used}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{r.webhook_url ?? "—"}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => setSelected(r)}>Manage</Button></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Reseller</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Webhook URL (optional)</Label><Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <DialogFooter><Button onClick={createReseller}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <ResellerDetailDialog
          reseller={selected}
          onClose={() => { setSelected(null); load(); }}
          newKey={newKey}
          setNewKey={setNewKey}
        />
      )}
    </DashboardLayout>
  );
}

function ResellerDetailDialog({ reseller, onClose, newKey, setNewKey }: { reseller: Reseller; onClose: () => void; newKey: string | null; setNewKey: (s: string | null) => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [topup, setTopup] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(reseller.webhook_url ?? "");

  const load = async () => {
    const [k, t, s, l] = await Promise.all([
      supabase.from("reseller_api_keys").select("*").eq("reseller_id", reseller.id).order("created_at", { ascending: false }),
      supabase.from("reseller_credit_transactions").select("*").eq("reseller_id", reseller.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("reseller_scans").select("*").eq("reseller_id", reseller.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("reseller_webhook_logs").select("*").eq("reseller_id", reseller.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys(k.data ?? []);
    setTx(t.data ?? []);
    setScans(s.data ?? []);
    setLogs(l.data ?? []);
  };
  useEffect(() => { load(); }, [reseller.id]);

  const generateKey = async () => {
    const raw = "psk_live_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const enc = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("reseller_api_keys").insert({
      reseller_id: reseller.id,
      key_hash: hash,
      key_prefix: raw.slice(0, 16),
      label: keyLabel || "API key",
    });
    if (error) return toast.error(error.message);
    setNewKey(raw);
    setKeyLabel("");
    load();
  };

  const revokeKey = async (id: string) => {
    await supabase.from("reseller_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const doTopup = async () => {
    const amt = parseInt(topup, 10);
    if (!amt || amt < 1) return toast.error("Invalid amount");
    const { data, error } = await supabase.rpc("topup_reseller_credits", {
      p_reseller_id: reseller.id, p_amount: amt, p_description: "Admin top-up",
    });
    if (error) return toast.error(error.message);
    if ((data as any)?.success === false) return toast.error((data as any).error);
    toast.success(`Added ${amt} credits`);
    setTopup("");
    load();
  };

  const toggleStatus = async () => {
    const ns = reseller.status === "active" ? "suspended" : "active";
    await supabase.from("resellers").update({ status: ns }).eq("id", reseller.id);
    toast.success(`Reseller ${ns}`);
    onClose();
  };

  const saveWebhook = async () => {
    await supabase.from("resellers").update({ webhook_url: webhookUrl || null }).eq("id", reseller.id);
    toast.success("Webhook updated");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reseller.name} <Badge className="ml-2">{reseller.status}</Badge></DialogTitle>
        </DialogHeader>

        {newKey && (
          <Card className="border-primary">
            <CardHeader><CardTitle className="text-sm">New API Key — copy now, you won't see it again</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Dismiss</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="scans">Scans</TabsTrigger>
            <TabsTrigger value="webhooks">Webhook Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Balance</div><div className="text-2xl font-bold">{reseller.credit_balance}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Purchased</div><div className="text-2xl font-bold">{reseller.total_credits_purchased}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Used</div><div className="text-2xl font-bold">{reseller.total_credits_used}</div></CardContent></Card>
            </div>
            <div><Label>Webhook URL</Label><div className="flex gap-2"><Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." /><Button onClick={saveWebhook}>Save</Button></div></div>
            <Button variant={reseller.status === "active" ? "destructive" : "default"} onClick={toggleStatus}>
              {reseller.status === "active" ? "Suspend" : "Activate"} Reseller
            </Button>
          </TabsContent>

          <TabsContent value="keys" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Label (e.g. production)" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
              <Button onClick={generateKey}><Plus className="h-4 w-4 mr-2" />Generate Key</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Prefix</TableHead><TableHead>Last Used</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.label ?? "—"}</TableCell>
                    <TableCell><code className="text-xs">{k.key_prefix}…</code></TableCell>
                    <TableCell className="text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</TableCell>
                    <TableCell>{k.revoked_at ? <Badge variant="destructive">Revoked</Badge> : <Badge>Active</Badge>}</TableCell>
                    <TableCell>{!k.revoked_at && <Button size="sm" variant="ghost" onClick={() => revokeKey(k.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="credits" className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Label>Top-up amount</Label><Input type="number" value={topup} onChange={(e) => setTopup(e.target.value)} /></div>
              <Button onClick={doTopup}>Add Credits</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Balance</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
              <TableBody>
                {tx.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{new Date(t.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{t.transaction_type}</Badge></TableCell>
                    <TableCell className={t.amount < 0 ? "text-destructive" : "text-green-600"}>{t.amount > 0 ? "+" : ""}{t.amount}</TableCell>
                    <TableCell>{t.balance_after}</TableCell>
                    <TableCell className="text-xs">{t.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="scans">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>File</TableHead><TableHead>Ext Ref</TableHead><TableHead>Status</TableHead><TableHead>AI %</TableHead></TableRow></TableHeader>
              <TableBody>
                {scans.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{s.file_name}</TableCell>
                    <TableCell className="text-xs">{s.external_reference ?? "—"}</TableCell>
                    <TableCell><Badge>{s.status}</Badge></TableCell>
                    <TableCell>{s.ai_percentage != null ? `${s.ai_percentage}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="webhooks">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Attempt</TableHead><TableHead>Status</TableHead><TableHead>Response</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell>#{l.attempt_number}</TableCell>
                    <TableCell>{l.succeeded ? <Badge>OK {l.response_status}</Badge> : <Badge variant="destructive">{l.response_status ?? "ERR"}</Badge>}</TableCell>
                    <TableCell className="text-xs max-w-md truncate">{l.error ?? l.response_body}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
