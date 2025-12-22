import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAIAdminHelper } from '@/hooks/useAIAdminHelper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Bot, 
  Send, 
  Loader2, 
  Check, 
  X, 
  History, 
  Shield, 
  AlertTriangle,
  RotateCcw,
  Trash2,
  MessageSquare,
  FileText,
  Eye,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminAIHelper() {
  const {
    isAdmin,
    messages,
    isLoading,
    isApplying,
    settings,
    settingsLoading,
    versions,
    auditLogs,
    auditLogsLoading,
    auditFilter,
    setAuditFilter,
    toggleAIHelper,
    sendMessage,
    approveChanges,
    rejectChanges,
    rollbackVersion,
    clearChat,
    refreshAuditLogs,
  } = useAIAdminHelper();

  const [input, setInput] = useState('');
  const [selectedLog, setSelectedLog] = useState<typeof auditLogs[0] | null>(null);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  const getSafetyBadge = (level: string) => {
    switch (level) {
      case 'safe':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><Check className="w-3 h-3 mr-1" /> Safe</Badge>;
      case 'review_required':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Review Required</Badge>;
      case 'not_allowed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Shield className="w-3 h-3 mr-1" /> Not Allowed</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Admin Helper</h1>
            <p className="text-muted-foreground">Intelligent assistant for site configuration and content editing</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="ai-toggle"
                checked={settings.is_enabled}
                onCheckedChange={toggleAIHelper}
                disabled={settingsLoading}
              />
              <Label htmlFor="ai-toggle" className="text-sm">
                {settings.is_enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
        </div>

        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Version History
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">AI Assistant</CardTitle>
                  </div>
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearChat}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Describe the changes you want to make. The AI will analyze and propose safe modifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4 mb-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <Bot className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">Start a conversation</p>
                      <p className="text-sm">Ask me to help with UI changes, configuration updates, or feature toggles.</p>
                      <div className="mt-4 text-xs space-y-1">
                        <p>Examples:</p>
                        <p className="text-primary">"Change the WhatsApp support number to +1234567890"</p>
                        <p className="text-primary">"Enable maintenance mode"</p>
                        <p className="text-primary">"Update the processing timeout to 60 minutes"</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                            
                            {message.proposedChanges && (
                              <div className="mt-4 pt-4 border-t border-border/50">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="font-medium text-sm">Proposed Changes</span>
                                  {getSafetyBadge(message.proposedChanges.safety_level)}
                                </div>
                                
                                <div className="space-y-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Type:</span>{' '}
                                    <span className="capitalize">{message.proposedChanges.change_type.replace('_', ' ')}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Affected Areas:</span>{' '}
                                    {message.proposedChanges.affected_areas.join(', ')}
                                  </div>
                                  {message.proposedChanges.changes && message.proposedChanges.changes.length > 0 && (
                                    <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                                      <p className="font-medium mb-1">Changes to apply:</p>
                                      {message.proposedChanges.changes.map((change, i) => (
                                        <div key={i} className="py-1 border-b border-border/30 last:border-0">
                                          <span className="text-muted-foreground">{change.target}:</span>{' '}
                                          <span className="text-red-400 line-through">{change.current_value || 'N/A'}</span>
                                          {' → '}
                                          <span className="text-green-400">{change.new_value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {message.proposedChanges.requires_code_change && (
                                    <p className="text-yellow-400 text-xs mt-2">
                                      ⚠️ This change requires code modifications
                                    </p>
                                  )}
                                </div>

                                {message.proposedChanges.safety_level !== 'not_allowed' && (
                                  <div className="flex gap-2 mt-4">
                                    <Button
                                      size="sm"
                                      onClick={() => approveChanges(message.id, message.proposedChanges!)}
                                      disabled={isApplying}
                                      className="gap-1"
                                    >
                                      {isApplying ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                      Apply Changes
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => rejectChanges(message.id)}
                                      disabled={isApplying}
                                      className="gap-1"
                                    >
                                      <X className="w-3 h-3" />
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg p-4">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <Separator className="my-4" />

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={settings.is_enabled 
                      ? "Describe the change you want to make..." 
                      : "Enable AI Helper to start..."
                    }
                    disabled={!settings.is_enabled || isLoading}
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <Button 
                    type="submit" 
                    disabled={!settings.is_enabled || isLoading || !input.trim()}
                    className="self-end"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Security Boundaries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-400 mb-2">✓ Allowed Operations</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Edit UI texts, labels, buttons</li>
                      <li>• Modify email/notification templates</li>
                      <li>• Toggle feature flags</li>
                      <li>• Adjust business rules</li>
                      <li>• Update configuration values</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-red-400 mb-2">✗ Restricted Operations</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Delete database tables</li>
                      <li>• Remove authentication</li>
                      <li>• Bypass security rules</li>
                      <li>• Access passwords/credentials</li>
                      <li>• Execute unrestricted code</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Change Version History</CardTitle>
                <CardDescription>
                  View all AI-assisted changes and rollback if needed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No changes have been applied yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className={`p-4 rounded-lg border ${
                          version.is_active 
                            ? 'border-border bg-card' 
                            : 'border-border/50 bg-muted/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">Version {version.version_number}</span>
                              <Badge variant={version.is_active ? 'default' : 'secondary'}>
                                {version.is_active ? 'Active' : 'Rolled Back'}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {version.change_type.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {version.change_description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {version.affected_areas.map((area, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {area}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Applied: {format(new Date(version.applied_at), 'PPpp')}
                              {version.rolled_back_at && (
                                <> • Rolled back: {format(new Date(version.rolled_back_at), 'PPpp')}</>
                              )}
                            </p>
                          </div>
                          {version.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rollbackVersion(version.id)}
                              className="gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Audit Logs</CardTitle>
                    <CardDescription>
                      Complete history of all AI prompts, responses, and admin actions
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={auditFilter}
                      onValueChange={(value: 'all' | 'pending' | 'approved' | 'rejected') => setAuditFilter(value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={refreshAuditLogs}>
                      <RefreshCw className={`w-4 h-4 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {auditLogsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No audit logs found</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Prompt</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Resolved</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(log.created_at), 'PP')}
                              <br />
                              <span className="text-muted-foreground">
                                {format(new Date(log.created_at), 'p')}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <p className="truncate text-sm">{log.prompt_text}</p>
                            </TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {log.resolved_at 
                                ? format(new Date(log.resolved_at), 'PP p') 
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedLog(log)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      Audit Log Details
                                      {getStatusBadge(log.status)}
                                    </DialogTitle>
                                    <DialogDescription>
                                      {format(new Date(log.created_at), 'PPpp')}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <ScrollArea className="max-h-[60vh]">
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-medium text-sm mb-2">Admin Prompt</h4>
                                        <div className="p-3 bg-muted rounded-lg text-sm">
                                          {log.prompt_text}
                                        </div>
                                      </div>
                                      <Separator />
                                      <div>
                                        <h4 className="font-medium text-sm mb-2">AI Response</h4>
                                        <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                          {log.ai_response}
                                        </div>
                                      </div>
                                      {log.proposed_changes && (
                                        <>
                                          <Separator />
                                          <div>
                                            <h4 className="font-medium text-sm mb-2">Proposed Changes</h4>
                                            <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                                              {JSON.stringify(log.proposed_changes, null, 2)}
                                            </pre>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
