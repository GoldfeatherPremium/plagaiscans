import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMagicLinks, MagicUploadLink } from '@/hooks/useMagicLinks';
import { useToast } from '@/hooks/use-toast';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Link2,
  Copy,
  Plus,
  Trash2,
  Ban,
  Loader2,
  Eye,
  Calendar,
  FileText,
  ExternalLink,
} from 'lucide-react';

export default function AdminMagicLinks() {
  const { toast } = useToast();
  const {
    magicLinks,
    loading,
    createMagicLink,
    disableMagicLink,
    deleteMagicLink,
    getMagicLinkFiles,
    deleteMagicFile,
  } = useMagicLinks();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [maxUploads, setMaxUploads] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [viewingFiles, setViewingFiles] = useState<{ link: MagicUploadLink; files: any[] } | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    await createMagicLink(maxUploads, expiresInHours);
    setCreating(false);
    setShowCreateDialog(false);
    setMaxUploads(1);
    setExpiresInHours(undefined);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/guest-upload?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied',
      description: 'Magic upload link copied to clipboard',
    });
  };

  const openLink = (token: string) => {
    const url = `${window.location.origin}/guest-upload?token=${token}`;
    window.open(url, '_blank');
  };

  const viewFiles = async (link: MagicUploadLink) => {
    setLoadingFiles(true);
    const files = await getMagicLinkFiles(link.id);
    setViewingFiles({ link, files });
    setLoadingFiles(false);
  };

  const handleDeleteFile = async (file: any) => {
    if (!viewingFiles) return;
    setDeletingFileId(file.id);
    const success = await deleteMagicFile(file.id, file.file_path, viewingFiles.link.id);
    if (success) {
      // Refresh the files list
      const updatedFiles = viewingFiles.files.filter(f => f.id !== file.id);
      setViewingFiles({ ...viewingFiles, files: updatedFiles });
    }
    setDeletingFileId(null);
  };

  const getStatusBadge = (link: MagicUploadLink) => {
    if (link.status === 'disabled') {
      return <Badge variant="destructive">Disabled</Badge>;
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (link.current_uploads >= link.max_uploads) {
      return <Badge variant="outline">Limit Reached</Badge>;
    }
    return <Badge className="bg-secondary text-secondary-foreground">Active</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Magic Upload Links</h1>
            <p className="text-muted-foreground mt-1">
              Generate temporary upload links for guests without accounts
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Magic Upload Link</DialogTitle>
                <DialogDescription>
                  Generate a new temporary upload link for guests. Links expire in 1 month by default.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="maxUploads">Maximum Uploads Allowed</Label>
                  <Input
                    id="maxUploads"
                    type="number"
                    min={1}
                    max={100}
                    value={maxUploads}
                    onChange={(e) => setMaxUploads(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many files can be uploaded with this link
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresIn">Custom Expiry (hours, optional)</Label>
                  <Input
                    id="expiresIn"
                    type="number"
                    min={1}
                    placeholder="Leave empty for 1 month"
                    value={expiresInHours || ''}
                    onChange={(e) => setExpiresInHours(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: 720 hours (1 month)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Link2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Links</p>
                  <p className="text-2xl font-bold">{magicLinks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Link2 className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Links</p>
                  <p className="text-2xl font-bold">
                    {magicLinks.filter(l => 
                      l.status === 'active' && 
                      l.current_uploads < l.max_uploads &&
                      (!l.expires_at || new Date(l.expires_at) > new Date())
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Uploads</p>
                  <p className="text-2xl font-bold">
                    {magicLinks.reduce((acc, l) => acc + l.current_uploads, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Magic Links Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : magicLinks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No magic links yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first magic upload link to share with guests
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Link
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-center">Uploads</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {magicLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {link.token.substring(0, 12)}...
                          </code>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">
                            {link.current_uploads} / {link.max_uploads}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(link.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(link.expires_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(link)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(link.token)}
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openLink(link.token)}
                              title="Open link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewFiles(link)}
                              title="View files"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {link.status === 'active' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => disableMagicLink(link.id)}
                                title="Disable link"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  title="Delete link"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Magic Link</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this magic link and all its uploaded files.
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMagicLink(link.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* View Files Dialog */}
        <Dialog open={!!viewingFiles} onOpenChange={() => setViewingFiles(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Uploaded Files</DialogTitle>
              <DialogDescription>
                Files uploaded via magic link: {viewingFiles?.link.token.substring(0, 12)}...
              </DialogDescription>
            </DialogHeader>
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : viewingFiles?.files.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No files uploaded yet
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {viewingFiles?.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted"
                  >
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'} • 
                        Uploaded {formatDate(file.uploaded_at)}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive shrink-0"
                          disabled={deletingFileId === file.id}
                          title="Delete file"
                        >
                          {deletingFileId === file.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete File</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{file.file_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteFile(file)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
