import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  RefreshCw, 
  Monitor, 
  Clock, 
  CheckCircle, 
  XCircle,
  Activity,
  Settings,
  AlertCircle,
  Wifi,
  WifiOff
} from "lucide-react";

// Generate a secure random token
const generateToken = () => {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const AdminExtensionManager: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenDialogOpen, setNewTokenDialogOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  
  // Slot management state
  const [newSlotDialogOpen, setNewSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [slotForm, setSlotForm] = useState({
    slot_name: "",
    slot_url: "",
    max_files_per_day: 25,
    notes: ""
  });

  // Fetch tokens
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["extension-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extension_tokens")
        .select("*, profiles(email, full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch slots
  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ["turnitin-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnitin_slots")
        .select("*")
        .order("slot_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["extension-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extension_logs")
        .select("*, extension_tokens(name, profiles(email)), documents(file_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Create token mutation
  const createTokenMutation = useMutation({
    mutationFn: async (name: string) => {
      const token = generateToken();
      const { data, error } = await supabase
        .from("extension_tokens")
        .insert({
          user_id: user?.id,
          token,
          name,
        })
        .select()
        .single();
      if (error) throw error;
      return { ...data, token };
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["extension-tokens"] });
      toast({ title: "Token Created", description: "Copy the token now - it won't be shown again!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete token mutation
  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("extension_tokens")
        .delete()
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extension-tokens"] });
      toast({ title: "Token Deleted" });
    },
  });

  // Toggle token active status
  const toggleTokenMutation = useMutation({
    mutationFn: async ({ tokenId, isActive }: { tokenId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("extension_tokens")
        .update({ is_active: isActive })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extension-tokens"] });
    },
  });

  // Create/Update slot mutation
  const saveSlotMutation = useMutation({
    mutationFn: async (slotData: any) => {
      if (editingSlot) {
        const { error } = await supabase
          .from("turnitin_slots")
          .update({
            slot_name: slotData.slot_name,
            slot_url: slotData.slot_url,
            max_files_per_day: slotData.max_files_per_day,
            notes: slotData.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSlot.id);
        if (error) throw error;
      } else {
        // Get next slot number
        const { data: maxSlot } = await supabase
          .from("turnitin_slots")
          .select("slot_number")
          .order("slot_number", { ascending: false })
          .limit(1)
          .single();
        
        const nextSlotNumber = (maxSlot?.slot_number || 0) + 1;
        
        const { error } = await supabase
          .from("turnitin_slots")
          .insert({
            ...slotData,
            slot_number: nextSlotNumber,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
      setNewSlotDialogOpen(false);
      setEditingSlot(null);
      setSlotForm({ slot_name: "", slot_url: "", max_files_per_day: 25, notes: "" });
      toast({ title: editingSlot ? "Slot Updated" : "Slot Created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle slot active status
  const toggleSlotMutation = useMutation({
    mutationFn: async ({ slotId, isActive }: { slotId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("turnitin_slots")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
    },
  });

  // Reset slot usage
  const resetSlotUsageMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from("turnitin_slots")
        .update({ current_usage: 0, last_reset_at: new Date().toISOString() })
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnitin-slots"] });
      toast({ title: "Slot Usage Reset" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleCreateToken = () => {
    if (!newTokenName.trim()) {
      toast({ title: "Error", description: "Please enter a token name", variant: "destructive" });
      return;
    }
    createTokenMutation.mutate(newTokenName);
  };

  const handleSaveSlot = () => {
    if (!slotForm.slot_name.trim() || !slotForm.slot_url.trim()) {
      toast({ title: "Error", description: "Name and URL are required", variant: "destructive" });
      return;
    }
    saveSlotMutation.mutate(slotForm);
  };

  const openEditSlot = (slot: any) => {
    setEditingSlot(slot);
    setSlotForm({
      slot_name: slot.slot_name,
      slot_url: slot.slot_url,
      max_files_per_day: slot.max_files_per_day,
      notes: slot.notes || "",
    });
    setNewSlotDialogOpen(true);
  };

  const isOnline = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return false;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 2 * 60 * 1000; // 2 minutes
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "error": return "destructive";
      case "report_uploaded": return "default";
      case "download": return "secondary";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Extension Manager</h1>
          <p className="text-muted-foreground">
            Manage Chrome extension tokens and Turnitin slot configurations
          </p>
        </div>

        <Tabs defaultValue="tokens" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tokens" className="gap-2">
              <Key className="h-4 w-4" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="status" className="gap-2">
              <Monitor className="h-4 w-4" />
              Status
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Extension Tokens</CardTitle>
                  <CardDescription>Generate and manage API tokens for Chrome extensions</CardDescription>
                </div>
                <Dialog open={newTokenDialogOpen} onOpenChange={(open) => {
                  setNewTokenDialogOpen(open);
                  if (!open) {
                    setNewTokenName("");
                    setGeneratedToken(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Generate Token
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate New Token</DialogTitle>
                      <DialogDescription>
                        Create a new API token for a Chrome extension instance
                      </DialogDescription>
                    </DialogHeader>
                    {!generatedToken ? (
                      <>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="token-name">Token Name</Label>
                            <Input
                              id="token-name"
                              placeholder="e.g., Staff PC - Chrome"
                              value={newTokenName}
                              onChange={(e) => setNewTokenName(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleCreateToken} disabled={createTokenMutation.isPending}>
                            {createTokenMutation.isPending ? "Generating..." : "Generate Token"}
                          </Button>
                        </DialogFooter>
                      </>
                    ) : (
                      <div className="space-y-4 py-4">
                        <div className="rounded-lg bg-muted p-4 space-y-2">
                          <Label>Your Token (copy now - won't be shown again!)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={generatedToken}
                              readOnly
                              className="font-mono text-xs"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => copyToClipboard(generatedToken)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => setNewTokenDialogOpen(false)}>Done</Button>
                        </DialogFooter>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Last Heartbeat</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokensLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : tokens?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No tokens created yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      tokens?.map((token: any) => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium">{token.name}</TableCell>
                          <TableCell>{token.profiles?.email || "Unknown"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={token.is_active}
                                onCheckedChange={(checked) => 
                                  toggleTokenMutation.mutate({ tokenId: token.id, isActive: checked })
                                }
                              />
                              <Badge variant={token.is_active ? "default" : "secondary"}>
                                {token.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {token.last_used_at 
                              ? formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })
                              : "Never"
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isOnline(token.last_heartbeat_at) ? (
                                <Wifi className="h-4 w-4 text-green-500" />
                              ) : (
                                <WifiOff className="h-4 w-4 text-muted-foreground" />
                              )}
                              {token.last_heartbeat_at 
                                ? formatDistanceToNow(new Date(token.last_heartbeat_at), { addSuffix: true })
                                : "Never"
                              }
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteTokenMutation.mutate(token.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tokens?.filter((t: any) => isOnline(t.last_heartbeat_at)).length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No extensions currently online</p>
                  </CardContent>
                </Card>
              ) : (
                tokens?.filter((t: any) => isOnline(t.last_heartbeat_at)).map((token: any) => (
                  <Card key={token.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{token.name}</CardTitle>
                        <Badge variant="default" className="gap-1">
                          <Wifi className="h-3 w-3" />
                          Online
                        </Badge>
                      </div>
                      <CardDescription>{token.profiles?.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Last seen: {formatDistanceToNow(new Date(token.last_heartbeat_at), { addSuffix: true })}</span>
                      </div>
                      {token.browser_info && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Monitor className="h-4 w-4" />
                          <span>{token.browser_info}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Turnitin Slots</CardTitle>
                  <CardDescription>Configure Turnitin submission slots and daily limits</CardDescription>
                </div>
                <Dialog open={newSlotDialogOpen} onOpenChange={(open) => {
                  setNewSlotDialogOpen(open);
                  if (!open) {
                    setEditingSlot(null);
                    setSlotForm({ slot_name: "", slot_url: "", max_files_per_day: 25, notes: "" });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Slot
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingSlot ? "Edit Slot" : "Add New Slot"}</DialogTitle>
                      <DialogDescription>
                        Configure a Turnitin submission slot
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="slot-name">Slot Name</Label>
                        <Input
                          id="slot-name"
                          placeholder="e.g., Main Account - Class 1"
                          value={slotForm.slot_name}
                          onChange={(e) => setSlotForm({ ...slotForm, slot_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slot-url">Turnitin Submission URL</Label>
                        <Input
                          id="slot-url"
                          placeholder="https://www.turnitin.com/..."
                          value={slotForm.slot_url}
                          onChange={(e) => setSlotForm({ ...slotForm, slot_url: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-files">Max Files Per Day</Label>
                        <Input
                          id="max-files"
                          type="number"
                          min={1}
                          max={100}
                          value={slotForm.max_files_per_day}
                          onChange={(e) => setSlotForm({ ...slotForm, max_files_per_day: parseInt(e.target.value) || 25 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Input
                          id="notes"
                          placeholder="Any additional notes..."
                          value={slotForm.notes}
                          onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSaveSlot} disabled={saveSlotMutation.isPending}>
                        {saveSlotMutation.isPending ? "Saving..." : editingSlot ? "Update Slot" : "Add Slot"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Usage Today</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Reset</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slotsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : slots?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No slots configured yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      slots?.map((slot: any) => (
                        <TableRow key={slot.id}>
                          <TableCell className="font-medium">{slot.slot_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{slot.slot_name}</div>
                              {slot.notes && (
                                <div className="text-xs text-muted-foreground">{slot.notes}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 w-32">
                              <div className="flex justify-between text-xs">
                                <span>{slot.current_usage}</span>
                                <span>/ {slot.max_files_per_day}</span>
                              </div>
                              <Progress 
                                value={(slot.current_usage / slot.max_files_per_day) * 100} 
                                className="h-2"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={slot.is_active}
                                onCheckedChange={(checked) => 
                                  toggleSlotMutation.mutate({ slotId: slot.id, isActive: checked })
                                }
                              />
                              <Badge variant={slot.is_active ? "default" : "secondary"}>
                                {slot.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {slot.last_reset_at 
                              ? format(new Date(slot.last_reset_at), "MMM d, h:mm a")
                              : "Never"
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => resetSlotUsageMutation.mutate(slot.id)}
                                title="Reset Usage"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditSlot(slot)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>Recent extension activity and events</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                        </TableRow>
                      ) : logs?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No activity logs yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs?.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              {format(new Date(log.created_at), "MMM d, h:mm:ss a")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getActionBadgeVariant(log.action)}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.extension_tokens?.name || "Unknown"}
                            </TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">
                              {log.documents?.file_name || "-"}
                            </TableCell>
                            <TableCell>
                              {log.status === "success" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : log.status === "error" ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {log.error_message || (log.metadata ? JSON.stringify(log.metadata) : "-")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminExtensionManager;
