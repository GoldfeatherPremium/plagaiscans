import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, RefreshCw, Key, Settings, Activity, Chrome, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ExtensionToken {
  id: string;
  user_id: string;
  token: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  last_heartbeat_at: string | null;
  browser_info: string | null;
  created_at: string;
  expires_at: string | null;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

interface TurnitinSlot {
  id: string;
  slot_number: number;
  slot_name: string;
  slot_url: string;
  is_active: boolean;
  max_files_per_day: number;
  current_usage: number;
  last_reset_at: string;
  notes: string | null;
}

interface ExtensionLog {
  id: string;
  token_id: string | null;
  action: string;
  document_id: string | null;
  status: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const AdminExtensionManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenUserId, setNewTokenUserId] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [newSlot, setNewSlot] = useState({
    slot_name: "",
    slot_url: "",
    max_files_per_day: 25,
    notes: "",
  });

  // Fetch tokens
  const { data: tokens = [], isLoading: tokensLoading, refetch: refetchTokens } = useQuery({
    queryKey: ["extension-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extension_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each token
      const userIds = [...new Set(data?.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      return data?.map(token => ({
        ...token,
        profile: profileMap.get(token.user_id),
      })) as ExtensionToken[];
    },
  });

  // Fetch slots
  const { data: slots = [], isLoading: slotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: ["turnitin-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnitin_slots")
        .select("*")
        .order("slot_number", { ascending: true });

      if (error) throw error;
      return data as TurnitinSlot[];
    },
  });

  // Fetch logs
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["extension-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extension_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ExtensionLog[];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch staff users for token creation
  const { data: staffUsers = [] } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["staff", "admin"]);

      if (error) throw error;

      const userIds = data?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      return profiles || [];
    },
  });

  // Create token mutation
  const createTokenMutation = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      // Generate secure token
      const tokenChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let tokenValue = "ext_";
      for (let i = 0; i < 64; i++) {
        tokenValue += tokenChars.charAt(Math.floor(Math.random() * tokenChars.length));
      }

      const { data, error } = await supabase
        .from("extension_tokens")
        .insert({
          user_id: userId,
          token: tokenValue,
          name,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Token created",
        description: "New extension token has been created. Copy it now!",
      });
      queryClient.invalidateQueries({ queryKey: ["extension-tokens"] });
      setShowCreateDialog(false);
      setNewTokenName("");
      setNewTokenUserId("");

      // Copy to clipboard
      navigator.clipboard.writeText(data.token);
      toast({
        title: "Token copied",
        description: "Token has been copied to clipboard",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle token mutation
  const toggleTokenMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("extension_tokens")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extension-tokens"] });
    },
  });

  // Delete token mutation
  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("extension_tokens")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Token deleted",
        description: "Extension token has been deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["extension-tokens"] });
    },
  });

  // Create slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (slot: typeof newSlot) => {
      const nextSlotNumber = (slots.length > 0 ? Math.max(...slots.map(s => s.slot_number)) : 0) + 1;

      const { error } = await supabase
        .from("turnitin_slots")
        .insert({
          ...slot,
          slot_number: nextSlotNumber,
          is_active: true,
          current_usage: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Slot created",
        description: "New Turnitin slot has been added",
      });
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
      setShowSlotDialog(false);
      setNewSlot({ slot_name: "", slot_url: "", max_files_per_day: 25, notes: "" });
    },
  });

  // Toggle slot mutation
  const toggleSlotMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("turnitin_slots")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
    },
  });

  // Reset slot usage mutation
  const resetSlotUsageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("turnitin_slots")
        .update({ current_usage: 0, last_reset_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Usage reset", description: "Slot usage has been reset to 0" });
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
    },
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("turnitin_slots")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Slot deleted" });
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
    },
  });

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Copied", description: "Token copied to clipboard" });
  };

  const isOnline = (heartbeat: string | null) => {
    if (!heartbeat) return false;
    const diff = Date.now() - new Date(heartbeat).getTime();
    return diff < 120000; // 2 minutes
  };

  const getActionColor = (action: string) => {
    if (action.includes("error")) return "destructive";
    if (action.includes("complete") || action.includes("success")) return "default";
    return "secondary";
  };

  return (
    <DashboardLayout>
      <SEO title="Extension Manager" description="Manage Turnitin automation extension" />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Extension Manager</h1>
          <p className="text-muted-foreground">Manage Chrome extension tokens and Turnitin slots for similarity queue automation</p>
        </div>

        <Tabs defaultValue="tokens">
          <TabsList>
            <TabsTrigger value="tokens" className="gap-2">
              <Key className="h-4 w-4" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="slots" className="gap-2">
              <Settings className="h-4 w-4" />
              Turnitin Slots
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* Tokens Tab */}
          <TabsContent value="tokens" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Chrome className="h-3 w-3" />
                  {tokens.filter(t => isOnline(t.last_heartbeat_at)).length} Online
                </Badge>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Token
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Extension Token</DialogTitle>
                    <DialogDescription>
                      Generate a new token for the Chrome extension
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Token Name</Label>
                      <Input
                        placeholder="e.g., Staff-John-Laptop"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assign to Staff</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={newTokenUserId}
                        onChange={(e) => setNewTokenUserId(e.target.value)}
                      >
                        <option value="">Select staff member...</option>
                        {staffUsers.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.full_name || staff.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createTokenMutation.mutate({ name: newTokenName, userId: newTokenUserId })}
                      disabled={!newTokenName || !newTokenUserId || createTokenMutation.isPending}
                    >
                      Create & Copy Token
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell>
                          {isOnline(token.last_heartbeat_at) ? (
                            <Badge className="gap-1 bg-green-500">
                              <CheckCircle2 className="h-3 w-3" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Offline
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{token.name}</TableCell>
                        <TableCell>{token.profile?.full_name || token.profile?.email || "Unknown"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {token.token.substring(0, 12)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToken(token.token)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {token.last_used_at
                            ? formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {token.browser_info || "-"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={token.is_active}
                            onCheckedChange={(checked) =>
                              toggleTokenMutation.mutate({ id: token.id, isActive: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteTokenMutation.mutate(token.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tokens.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No extension tokens yet. Create one to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Configure Turnitin classroom slots for document processing
              </p>
              <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Slot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Turnitin Slot</DialogTitle>
                    <DialogDescription>
                      Configure a new Turnitin classroom slot
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Slot Name</Label>
                      <Input
                        placeholder="e.g., Class A - Slot 1"
                        value={newSlot.slot_name}
                        onChange={(e) => setNewSlot({ ...newSlot, slot_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Turnitin URL</Label>
                      <Input
                        placeholder="https://www.turnitin.com/..."
                        value={newSlot.slot_url}
                        onChange={(e) => setNewSlot({ ...newSlot, slot_url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Files Per Day</Label>
                      <Input
                        type="number"
                        value={newSlot.max_files_per_day}
                        onChange={(e) => setNewSlot({ ...newSlot, max_files_per_day: parseInt(e.target.value) || 25 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Input
                        placeholder="Any notes about this slot..."
                        value={newSlot.notes}
                        onChange={(e) => setNewSlot({ ...newSlot, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createSlotMutation.mutate(newSlot)}
                      disabled={!newSlot.slot_name || !newSlot.slot_url || createSlotMutation.isPending}
                    >
                      Add Slot
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <Card key={slot.id} className={!slot.is_active ? "opacity-50" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{slot.slot_name}</CardTitle>
                      <Switch
                        checked={slot.is_active}
                        onCheckedChange={(checked) =>
                          toggleSlotMutation.mutate({ id: slot.id, isActive: checked })
                        }
                      />
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      Slot #{slot.slot_number}
                      <a
                        href={slot.slot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Usage Today</span>
                        <span className="font-medium">{slot.current_usage} / {slot.max_files_per_day}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min((slot.current_usage / slot.max_files_per_day) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    {slot.notes && (
                      <p className="text-xs text-muted-foreground">{slot.notes}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => resetSlotUsageMutation.mutate(slot.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteSlotMutation.mutate(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {slots.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No Turnitin slots configured. Add one to get started.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Real-time activity from connected extensions
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Document ID</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionColor(log.action)}>
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.status && (
                            <Badge variant={log.status === "success" ? "default" : "destructive"}>
                              {log.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.document_id?.substring(0, 8) || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.error_message || (log.metadata && Object.keys(log.metadata).length > 0 
                            ? JSON.stringify(log.metadata) 
                            : "-")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No activity logs yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminExtensionManager;
