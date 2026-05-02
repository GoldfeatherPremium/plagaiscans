import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, Trash2, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

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
}

export default function ResellerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reseller, setReseller] = useState<Reseller | null>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [keyLabel, setKeyLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: r } = await supabase.from("resellers").select("*").eq("user_id", user.id).maybeSingle();
    if (!r) { setLoading(false); return; }
    setReseller(r as Reseller);
    setName(r.name);
    setWebhookUrl(r.webhook_url ?? "");

    const [k, t, s, l] = await Promise.all([
      supabase.from("reseller_api_keys").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false }),
      supabase.from("reseller_credit_transactions").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("reseller_scans").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("reseller_webhook_logs").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys(k.data ?? []);
    setTx(t.data ?? []);
    setScans(s.data ?? []);
    setLogs(l.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user?.id]);

  const generateKey = async () => {
    if (!reseller) return;
    const raw = "psk_live_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join("");
    const enc = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("reseller_api_keys").insert({
      reseller_id: reseller.id,
      key_hash: hash,
      key_prefix: raw.slice(0, 16),
      label: keyLabel || "API key",
    });
    if (error) return toast.error(error.message);
    setNewKey(raw);
    setKeyLabel("");
    loadAll();
  };

  const revokeKey = async (id: string) => {
    await supabase.from("reseller_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    loadAll();
  };

  const saveProfile = async () => {
    if (!reseller) return;
    const { error } = await supabase.from("resellers")
      .update({ name, webhook_url: webhookUrl || null })
      .eq("id", reseller.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    loadAll();
  };

  if (loading) {
    return <DashboardLayout><div className="p-6">Loading…</div></DashboardLayout>;
  }

  if (!reseller) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card><CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No reseller account is linked to this login. Please contact support.</p>
          </CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{reseller.name}</h1>
            <p className="text-sm text-muted-foreground">Reseller portal — manage API keys, credits, and webhook.</p>
          </div>
          <div className="flex gap-2">
            <Badge variant={reseller.status === "active" ? "default" : "destructive"}>{reseller.status}</Badge>
            <Link to="/api-docs"><Button variant="outline" size="sm"><BookOpen className="h-4 w-4 mr-2" />API Docs</Button></Link>
          </div>
        </div>

        {newKey && (
          <Card className="border-primary">
            <CardHeader><CardTitle className="text-sm">New API Key — copy now, you won't see it again</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Dismiss</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Credit Balance</div><div className="text-2xl font-bold">{reseller.credit_balance}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Purchased</div><div className="text-2xl font-bold">{reseller.total_credits_purchased}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Used</div><div className="text-2xl font-bold">{reseller.total_credits_used}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="keys">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="credits">Credit History</TabsTrigger>
            <TabsTrigger value="scans">Scans</TabsTrigger>
            <TabsTrigger value="webhooks">Webhook Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Label (e.g. production)" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
              <Button onClick={generateKey}><Plus className="h-4 w-4 mr-2" />Generate Key</Button>
            </div>
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Prefix</TableHead><TableHead>Last Used</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {keys.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No API keys yet</TableCell></TableRow> :
                    keys.map(k => (
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
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-3">
            <Card><CardContent className="p-4 space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Webhook URL</Label><Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-site.com/webhook" /></div>
              <p className="text-xs text-muted-foreground">Webhooks are signed with HMAC-SHA256. See the API docs for verification details.</p>
              <Button onClick={saveProfile}>Save Changes</Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="credits">
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Balance</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tx.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No transactions</TableCell></TableRow> :
                    tx.map(t => (
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
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="scans">
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>File</TableHead><TableHead>Ext Ref</TableHead><TableHead>Status</TableHead><TableHead>AI %</TableHead></TableRow></TableHeader>
                <TableBody>
                  {scans.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No scans yet</TableCell></TableRow> :
                    scans.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{s.file_name}</TableCell>
                        <TableCell className="text-xs">{s.external_reference ?? "—"}</TableCell>
                        <TableCell><Badge>{s.status}</Badge></TableCell>
                        <TableCell>{s.ai_percentage != null ? (s.ai_percentage >= 1 && s.ai_percentage <= 19 ? '*%' : `${s.ai_percentage}%`) : "—"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="webhooks">
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Attempt</TableHead><TableHead>Status</TableHead><TableHead>Response</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No webhook deliveries</TableCell></TableRow> :
                    logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell>#{l.attempt_number}</TableCell>
                        <TableCell>{l.succeeded ? <Badge>OK {l.response_status}</Badge> : <Badge variant="destructive">{l.response_status ?? "ERR"}</Badge>}</TableCell>
                        <TableCell className="text-xs max-w-md truncate">{l.error ?? l.response_body}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
