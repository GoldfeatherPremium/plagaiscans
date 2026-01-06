import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useMagicLinks, MagicUploadLink, MagicUploadFile } from '@/hooks/useMagicLinks';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowRight,
  Loader2,
  FileCheck,
  CreditCard,
  Download,
  MessageCircle,
  Clock,
  XCircle,
  Trash2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
}

export default function GuestUpload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { validateMagicLink, validateMagicLinkForAccess, uploadFileWithMagicLink, getFilesByToken, downloadMagicFile, deleteGuestDocument } = useMagicLinks();
  
  const [linkData, setLinkData] = useState<MagicUploadLink | null>(null);
  const [files, setFiles] = useState<MagicUploadFile[]>([]);
  const [validating, setValidating] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  const [excludeBibliographic, setExcludeBibliographic] = useState(true);
  const [excludeQuoted, setExcludeQuoted] = useState(false);
  const [excludeSmallSources, setExcludeSmallSources] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<MagicUploadFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setLinkError('No upload token provided');
        setValidating(false);
        return;
      }

      // Use validateMagicLinkForAccess to allow access even when upload limit is reached
      const data = await validateMagicLinkForAccess(token);
      if (!data) {
        setLinkError('This link is invalid or expired');
        setValidating(false);
        return;
      }

      setLinkData(data);
      setValidating(false);

      // Fetch uploaded files for this token
      const uploadedFiles = await getFilesByToken(token);
      setFiles(uploadedFiles);
    };

    validate();
  }, [token]);

  // Fetch pricing packages
  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true });
      
      setPackages(data || []);
      setLoadingPackages(false);
    };
    fetchPackages();
  }, []);

  // Refresh files after upload
  const refreshFiles = async () => {
    if (token) {
      const uploadedFiles = await getFilesByToken(token);
      setFiles(uploadedFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadSuccess(false);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadSuccess(false);
    }
    // Clear to avoid stale FileList sticking around
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setUploading(true);
    const success = await uploadFileWithMagicLink(token, selectedFile);
    setUploading(false);

    if (success) {
      setUploadSuccess(true);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';

      // Refresh link data and files using access validation (allows viewing after limit reached)
      const data = await validateMagicLinkForAccess(token);
      setLinkData(data);
      await refreshFiles();
    }
  };

  const remainingUploads = linkData ? linkData.max_uploads - linkData.current_uploads : 0;
  const canUpload = linkData && remainingUploads > 0;

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const openWhatsApp = (credits: number) => {
    const message = encodeURIComponent(`Hello! I'm interested in purchasing ${credits} credits for PlagaiScans.`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleDeleteClick = (file: MagicUploadFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete || !linkData) return;
    
    setIsDeleting(true);
    const success = await deleteGuestDocument(
      fileToDelete.id,
      fileToDelete.file_path,
      linkData.id,
      fileToDelete.similarity_report_path,
      fileToDelete.ai_report_path
    );
    
    if (success) {
      await refreshFiles();
      // Refresh link data to update upload count
      const data = await validateMagicLinkForAccess(token!);
      setLinkData(data);
    }
    
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  // Show loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating upload link...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (linkError && !linkData) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">PlagaiScans</span>
            </Link>
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        </header>
        <div className="max-w-md mx-auto mt-20 p-4">
          <Card className="border-destructive">
            <CardContent className="py-12 text-center">
              <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
              <p className="text-muted-foreground mb-6">{linkError}</p>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Want to check documents? Create an account to get started.
                </p>
                <Button asChild>
                  <Link to="/auth">Sign Up / Sign In</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">PlagaiScans</span>
          </Link>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-2">
              <Clock className="h-3 w-3" />
              Guest Access
            </Badge>
            <Button asChild variant="outline">
              <Link to="/auth">Sign In for More</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="documents">My Documents</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-display font-bold">Guest Upload</h1>
                <p className="text-muted-foreground mt-1">
                  Upload your document for plagiarism checking
                </p>
              </div>

              {/* Upload Status */}
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Upload Limit</p>
                    <p className="text-sm text-muted-foreground">
                      {remainingUploads} of {linkData?.max_uploads} uploads remaining
                    </p>
                  </div>
                  {!canUpload && (
                    <Badge variant="destructive">Limit Reached</Badge>
                  )}
                </CardContent>
              </Card>

              {/* Upload Limit Reached */}
              {!canUpload && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">Upload Limit Reached</p>
                      <p className="text-sm text-muted-foreground">
                        Create an account to upload more documents
                      </p>
                    </div>
                    <Button asChild>
                      <Link to="/auth">Sign Up</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Upload Success */}
              {uploadSuccess && (
                <Card className="border-secondary bg-secondary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-secondary" />
                    <div className="flex-1">
                      <p className="font-medium text-secondary">Document Uploaded Successfully!</p>
                      <p className="text-sm text-muted-foreground">
                        Your document is now in the queue and will be processed soon.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Options (exclusion) */}
              {canUpload && (
                <>
                  <div className="space-y-4">
                    <Label className="text-base">Options (exclusion)</Label>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="exclude-bibliographic" className="font-normal cursor-pointer">
                          Exclude bibliographic materials
                        </Label>
                        <Switch
                          id="exclude-bibliographic"
                          checked={excludeBibliographic}
                          onCheckedChange={setExcludeBibliographic}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="exclude-quoted" className="font-normal cursor-pointer">
                          Exclude quoted materials
                        </Label>
                        <Switch
                          id="exclude-quoted"
                          checked={excludeQuoted}
                          onCheckedChange={setExcludeQuoted}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="exclude-small" className="font-normal cursor-pointer">
                          Exclude small sources
                        </Label>
                        <Switch
                          id="exclude-small"
                          checked={excludeSmallSources}
                          onCheckedChange={setExcludeSmallSources}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Document Upload Area */}
                  <div className="space-y-2">
                    <Label className="text-base">Document</Label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                        dragActive
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => inputRef.current?.click()}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx,.html,.rtf,.odt"
                        onChange={handleChange}
                      />
                      
                      {selectedFile ? (
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-muted">
                            <FileText className="h-8 w-8 text-primary" />
                            <div className="text-left">
                              <p className="font-medium">{selectedFile.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              if (inputRef.current) inputRef.current.value = '';
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="font-medium">Drag and drop file here</p>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Uploaded file must be less than <strong className="text-foreground">100 MB</strong></p>
                            <p>Files must contain <strong className="text-foreground">over 20 words</strong></p>
                            <p className="text-amber-600 dark:text-amber-500">.docx, .xlsx, .pptx, .pdf, .html, .rtf, .odt, .txt</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notices */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      The file you are submitting will not be added to any repository.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleUpload} 
                      disabled={!selectedFile || uploading}
                      className="gap-2"
                    >
                      {uploading ? 'Submitting...' : 'Submit'}
                      {!uploading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold">My Documents</h1>
              <p className="text-muted-foreground mt-1">
                View your uploaded documents and their status
              </p>
            </div>

            {files.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">No documents yet</h3>
                  <p className="text-muted-foreground">
                    Upload your first document to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Upload Time</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Similarity %</TableHead>
                          <TableHead className="text-center">AI %</TableHead>
                          <TableHead className="text-center">Similarity Report</TableHead>
                          <TableHead className="text-center">AI Report</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {files.map((file, index) => {
                          const { date, time } = formatDateTime(file.uploaded_at);
                          const status = file.status || 'pending';
                          const isDeleted = file.deleted_by_user;
                          return (
                            <TableRow 
                              key={file.id}
                              className={isDeleted ? 'opacity-50 bg-muted/30' : ''}
                            >
                              <TableCell className="text-center font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className={`h-4 w-4 flex-shrink-0 ${isDeleted ? 'text-muted-foreground' : 'text-primary'}`} />
                                  <span className={`font-medium truncate max-w-[200px] ${isDeleted ? 'line-through text-muted-foreground' : ''}`} title={file.file_name}>
                                    {file.file_name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>{date}</div>
                                  <div className="text-muted-foreground">{time}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {isDeleted ? (
                                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                                    Deleted by user
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant={
                                      status === 'completed'
                                        ? 'default'
                                        : status === 'in_progress'
                                          ? 'secondary'
                                          : 'outline'
                                    }
                                  >
                                    {status === 'in_progress'
                                      ? 'Processing'
                                      : status.charAt(0).toUpperCase() + status.slice(1)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!isDeleted && file.similarity_percentage !== null && file.similarity_percentage !== undefined ? (
                                  <Badge variant={file.similarity_percentage > 20 ? 'destructive' : file.similarity_percentage > 10 ? 'secondary' : 'default'}>
                                    {file.similarity_percentage}%
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!isDeleted && file.ai_percentage !== null && file.ai_percentage !== undefined ? (
                                  <Badge variant={file.ai_percentage > 20 ? 'destructive' : file.ai_percentage > 10 ? 'secondary' : 'default'}>
                                    {file.ai_percentage}%
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!isDeleted && file.similarity_report_path ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      downloadMagicFile(
                                        file.similarity_report_path!,
                                        `${file.file_name}_similarity.pdf`,
                                        'reports'
                                      )
                                    }
                                    title="Download Similarity Report"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!isDeleted && file.ai_report_path ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      downloadMagicFile(file.ai_report_path!, `${file.file_name}_ai.pdf`, 'reports')
                                    }
                                    title="Download AI Report"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isDeleted ? (
                                  <span className="text-sm text-muted-foreground italic">
                                    Deleted {file.deleted_at ? formatDateTime(file.deleted_at).date : ''}
                                  </span>
                                ) : file.remarks ? (
                                  <span className="text-sm text-foreground">{file.remarks}</span>
                                ) : status === 'pending' ? (
                                  <span className="text-sm text-muted-foreground">In queue</span>
                                ) : status === 'in_progress' ? (
                                  <span className="text-sm text-muted-foreground">Processing...</span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!isDeleted && status === 'completed' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteClick(file)}
                                    title="Delete document permanently"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Refresh reminder */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Info className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Refresh this page to see updated results after processing is complete.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold">Pricing</h1>
              <p className="text-muted-foreground mt-1">
                Sign up to purchase credits and check more documents
              </p>
            </div>

            {/* Sign Up CTA */}
            <Card className="gradient-primary text-primary-foreground">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                    <CreditCard className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Want to purchase credits?</p>
                    <p className="text-xl font-bold">Create an account first</p>
                  </div>
                </div>
                <Button asChild variant="secondary">
                  <Link to="/auth">Sign Up Now</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pricing Plans */}
            {loadingPackages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {packages.map((plan) => (
                  <Card key={plan.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold">
                            {plan.credits} {plan.credits === 1 ? 'Credit' : 'Credits'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            ${(plan.price / plan.credits).toFixed(2)} per document
                          </p>
                        </div>
                        <p className="text-3xl font-bold text-primary">${plan.price}</p>
                      </div>
                      <ul className="space-y-2 mb-4 text-sm">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-secondary" />
                          Similarity Detection
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-secondary" />
                          AI Content Detection
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-secondary" />
                          Detailed PDF Reports
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-secondary" />
                          Credits Never Expire
                        </li>
                      </ul>
                      <Button
                        className="w-full"
                        asChild
                      >
                        <Link to="/auth">Sign Up to Purchase</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* How it works */}
            <Card>
              <CardHeader>
                <CardTitle>How to Get More Credits</CardTitle>
                <CardDescription>
                  Create an account to access unlimited document checking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium">Create an Account</h4>
                      <p className="text-sm text-muted-foreground">
                        Sign up with your email to get started
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium">Purchase Credits</h4>
                      <p className="text-sm text-muted-foreground">
                        Choose a credit package and complete payment
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium">Upload Documents</h4>
                      <p className="text-sm text-muted-foreground">
                        Use your credits to check as many documents as you need
                      </p>
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} PlagaiScans. All rights reserved.</p>
          <p className="mt-1">
            Trading Name: PlagaiScans | Legal Entity: Goldfeather Prem Ltd (United Kingdom)
          </p>
          <p className="mt-2 text-xs">
            This service is provided for informational and research purposes only.
          </p>
        </div>
      </footer>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{fileToDelete?.file_name}" and all associated reports. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
