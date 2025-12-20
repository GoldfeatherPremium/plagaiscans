import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useMagicLinks, MagicLink, MagicUploadFile } from '@/hooks/useMagicLinks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link2, Plus, Copy, Trash2, Ban, Eye, FileText, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const AdminMagicLinks: React.FC = () => {
  const { links, loading, createLink, disableLink, deleteLink, getUploadedFiles } = useMagicLinks();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [maxUploads, setMaxUploads] = useState(1);
  const [expiryHours, setExpiryHours] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [viewFilesDialogOpen, setViewFilesDialogOpen] = useState(false);
  const [selectedLinkFiles, setSelectedLinkFiles] = useState<MagicUploadFile[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const handleCreate = async () => {
    if (maxUploads < 1) {
      toast({
        title: 'Invalid Input',
        description: 'Maximum uploads must be at least 1',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    const result = await createLink(maxUploads, expiryHours || undefined);
    setCreating(false);

    if (result) {
      setCreateDialogOpen(false);
      setMaxUploads(1);
      setExpiryHours('');
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/upload?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied',
      description: 'Magic upload link copied to clipboard',
    });
  };

  const handleViewFiles = async (linkId: string) => {
    setSelectedLinkId(linkId);
    setLoadingFiles(true);
    setViewFilesDialogOpen(true);
    const files = await getUploadedFiles(linkId);
    setSelectedLinkFiles(files);
    setLoadingFiles(false);
  };

  const getStatusBadge = (link: MagicLink) => {
    if (link.status === 'disabled') {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (link.current_uploads >= link.max_uploads) {
      return <Badge variant="outline">Limit Reached</Badge>;
    }
    return <Badge className="bg-secondary text-secondary-foreground">Active</Badge>;
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-6 w-6 text-primary" />
              Magic Upload Links
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate temporary upload links for guests without requiring signup
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                  Generate a temporary link that allows guests to upload files without an account
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="maxUploads">Maximum Uploads</Label>
                  <Input
                    id="maxUploads"
                    type="number"
                    min={1}
                    max={100}
                    value={maxUploads}
                    onChange={(e) => setMaxUploads(parseInt(e.target.value) || 1)}
                    placeholder="Number of files allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many files can be uploaded with this link
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiryHours">Expiry Time (Optional)</Label>
                  <Input
                    id="expiryHours"
                    type="number"
                    min={1}
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="Hours until link expires"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for no expiration
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Link'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Links</CardTitle>
            <CardDescription>
              Manage your magic upload links. Active links can be used by guests to upload files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No magic links created yet</p>
                <p className="text-sm">Create your first link to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Uploads</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>{getStatusBadge(link)}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {link.token.substring(0, 12)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {link.current_uploads} / {link.max_uploads}
                          </span>
                        </TableCell>
                        <TableCell>
                          {link.expires_at
                            ? format(new Date(link.expires_at), 'MMM d, yyyy HH:mm')
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(link.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
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
                              onClick={() => window.open(`/upload?token=${link.token}`, '_blank')}
                              title="Open link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewFiles(link.id)}
                              title="View uploaded files"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {link.status === 'active' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => disableLink(link.id)}
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
                                  className="text-destructive hover:text-destructive"
                                  title="Delete link"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Magic Link?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this magic link and all associated
                                    file records. The uploaded files will remain in storage.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteLink(link.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
            )}
          </CardContent>
        </Card>

        {/* View Files Dialog */}
        <Dialog open={viewFilesDialogOpen} onOpenChange={setViewFilesDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Uploaded Files</DialogTitle>
              <DialogDescription>
                Files uploaded via this magic link (tagged as Guest Upload)
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : selectedLinkFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No files uploaded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLinkFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.file_name}</TableCell>
                        <TableCell>{formatBytes(file.file_size)}</TableCell>
                        <TableCell>
                          {format(new Date(file.uploaded_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewFilesDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminMagicLinks;
