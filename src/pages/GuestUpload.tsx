import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useMagicLinks, MagicUploadLink, MagicUploadFile } from '@/hooks/useMagicLinks';
import { supabase } from '@/integrations/supabase/client';
import { GuestEmailBanner } from '@/components/GuestEmailBanner';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { WhatsAppSupportButton } from '@/components/WhatsAppSupportButton';
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
  Mail,
  MessageSquare,
  Sparkles,
  Crown,
  Zap,
  Shield,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  package_type: string;
  billing_interval: string | null;
  validity_days: number | null;
  name: string | null;
  description: string | null;
  features: string[] | null;
  credit_type: string;
  is_most_popular?: boolean;
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

  // Fetch pricing packages based on link's special status
  useEffect(() => {
    const fetchPackages = async () => {
      const isSpecial = linkData?.is_special || false;
      const { data } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .eq('is_special', isSpecial)
        .order('credits', { ascending: true });
      
      setPackages(data || []);
      setLoadingPackages(false);
    };
    if (linkData !== null) {
      fetchPackages();
    }
  }, [linkData]);

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
      const file = e.dataTransfer.files[0];
      if (/\.doc$/i.test(file.name)) {
        toast.error('.doc format is not supported. Please convert to .docx and try again.');
      } else {
        setSelectedFile(file);
        setUploadSuccess(false);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (/\.doc$/i.test(file.name)) {
        toast.error('.doc format is not supported. Please convert to .docx and try again.');
      } else {
        setSelectedFile(file);
        setUploadSuccess(false);
      }
    }
    // Clear to avoid stale FileList sticking around
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setUploading(true);
    const success = await uploadFileWithMagicLink(token, selectedFile, {
      exclude_bibliography: excludeBibliographic,
      exclude_quotes: excludeQuoted,
      exclude_small_sources: excludeSmallSources,
    });
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
              <Link to={linkData?.is_special ? "/auth?guest_special=true" : "/auth"}>Sign In for More</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Announcements for guests */}
        <AnnouncementBanner isGuestPage />

        {/* Guest Email Banner - Show if no email registered */}
        {linkData && !linkData.guest_email && token && (
          <GuestEmailBanner 
            token={token} 
            onEmailSaved={(email, name) => {
              setLinkData(prev => prev ? {...prev, guest_email: email, guest_name: name} : null);
            }}
          />
        )}

        {/* Email Registered Confirmation */}
        {linkData?.guest_email && (
          <Card className="border-secondary/30 bg-secondary/5 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-secondary" />
              <div className="flex-1">
                <p className="font-medium text-secondary">Email notifications enabled</p>
                <p className="text-sm text-muted-foreground">
                  You'll receive an email at <strong>{linkData.guest_email}</strong> when your documents are ready
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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

              {/* Link Expiry Info */}
              {linkData?.expires_at && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Link Expires</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(linkData.expires_at).date} at {formatDateTime(linkData.expires_at).time}
                      </p>
                    </div>
                    {new Date(linkData.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 && (
                      <Badge variant="outline" className="border-amber-500 text-amber-500">
                        Expiring Soon
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}

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
                      <Link to={linkData?.is_special ? "/auth?guest_special=true" : "/auth"}>Sign Up</Link>
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

              {/* No Repository Notice */}
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Your document will NOT be stored in any repository</p>
                  </div>
                </CardContent>
              </Card>

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
                        accept=".pdf,.docx,.txt,.xlsx,.pptx,.ps,.html,.rtf,.odt,.hwp"
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
                                ) : status === 'cancelled' ? (
                                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">
                                    Cancelled
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
                                  <span className="text-muted-foreground">·</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!isDeleted && file.ai_percentage !== null && file.ai_percentage !== undefined ? (
                                  <Badge variant={file.ai_percentage > 20 ? 'destructive' : file.ai_percentage > 10 ? 'secondary' : 'default'}>
                                    {file.ai_percentage}%
                                  </Badge>
                                ) : (
                                  <span className="font-medium">*</span>
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
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                {isDeleted ? (
                                  <span className="text-sm text-muted-foreground italic">
                                    Deleted {file.deleted_at ? formatDateTime(file.deleted_at).date : ''}
                                  </span>
                                ) : status === 'cancelled' ? (
                                  <span className="text-sm text-destructive font-medium">
                                    {file.cancellation_reason || 'Cancelled by admin'}
                                  </span>
                                ) : file.remarks ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        <MessageSquare className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <p className="text-sm">{file.remarks}</p>
                                    </PopoverContent>
                                  </Popover>
                                ) : status === 'pending' ? (
                                  <span className="text-sm text-muted-foreground">In queue</span>
                                ) : status === 'in_progress' ? (
                                  <span className="text-sm text-muted-foreground">Processing...</span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                                {status === 'completed' && (file.ai_percentage === null || file.ai_percentage === undefined) && file.similarity_report_path && file.ai_report_path && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full flex-shrink-0">
                                        <Info className="h-3.5 w-3.5 text-primary" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 text-sm" side="top">
                                      <p className="font-medium mb-1">AI % Note</p>
                                      <p className="text-muted-foreground text-xs leading-relaxed">
                                        AI % is in range between 1 to 19%. AI detection scores below 20% have a higher likelihood of false positives. In the updated version of the report, we no longer surface scores when the signal is below the 20% threshold to meet Turnitin's AI detection standards.
                                      </p>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                </div>
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
            {/* Check Before You Submit — hero */}
            <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-secondary/5 via-background to-primary/5 px-6 py-12">
              <div className="text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-6">
                  <Sparkles className="h-4 w-4 text-secondary" />
                  <span className="text-[13px] font-bold tracking-wide uppercase text-secondary">
                    Official Turnitin Reports
                  </span>
                </div>
                <h1 className="font-display font-bold tracking-tight leading-[1.05] text-[32px] sm:text-[44px] text-foreground mb-4">
                  Check Before You Submit
                </h1>
                <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto mb-8">
                  Get the <span className="font-semibold text-foreground">exact same report</span> your professor uses. AI detection + similarity analysis from <span className="font-bold text-primary">$3.99</span>
                </p>

                {/* No Repository highlight card */}
                <div className="max-w-xl mx-auto rounded-2xl bg-secondary/5 border border-secondary/20 p-6 mb-8">
                  <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <Lock className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-secondary mb-2">
                    No Repository = Zero Trace
                  </h2>
                  <p className="text-sm sm:text-base text-secondary/80">
                    Your paper is NOT stored. Submit to your university later with complete confidence.
                  </p>
                </div>

                {/* Trust badges */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-md mx-auto text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span>Real Turnitin</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-5 w-5 text-primary shrink-0" />
                    <span>No Repository</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary shrink-0" />
                    <span>2-5 Min Results</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-5 w-5 text-primary shrink-0" />
                    <span>Zero Self-Plagiarism Risk</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Pricing Plans */}
            {loadingPackages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(() => {
                  const hasAdminPopular = packages.some(p => p.is_most_popular);
                  return packages.map((plan, index) => {
                    const isPopular = hasAdminPopular
                      ? !!plan.is_most_popular
                      : index === packages.length - 1 && packages.length > 1;
                    const isSubscription = plan.package_type === 'subscription';

                    return (
                      <Card
                        key={plan.id}
                        className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                          isPopular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
                        }`}
                      >
                        {isPopular && (
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg z-10">
                            Best Value
                          </div>
                        )}
                        {isSubscription && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />
                        )}
                        <CardHeader className="text-center pb-4">
                          <div className={`mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-2 ${
                            isSubscription ? 'bg-green-500/10' : 'bg-primary/10'
                          }`}>
                            {isSubscription ? (
                              <Crown className="h-5 w-5 text-green-600" />
                            ) : (
                              <Zap className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <CardTitle className="text-2xl font-display">
                            {plan.name || `${plan.credits} Credits`}
                          </CardTitle>
                          <div className="mt-4">
                            <span className={`text-5xl font-bold ${isSubscription ? 'text-green-600' : ''}`}>
                              ${plan.price}
                            </span>
                            {isSubscription && (
                              <span className="text-muted-foreground text-sm">/{plan.billing_interval || 'month'}</span>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-2">
                            {isSubscription
                              ? `${plan.credits} credits per ${plan.billing_interval || 'month'}`
                              : `$${(plan.price / plan.credits).toFixed(2)} per credit`
                            }
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            1 credit = 1 document check
                          </p>
                          {plan.validity_days && (
                            <Badge variant="outline" className="mt-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Clock className="h-3 w-3 mr-1" />
                              Valid for {plan.validity_days} days
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="pt-4">
                          <ul className="space-y-3 mb-8">
                            {plan.features && plan.features.length > 0 ? (
                              plan.features.map((feature, featureIndex) => (
                                <li key={featureIndex} className="flex items-center gap-3">
                                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                  <span className="text-muted-foreground">{feature}</span>
                                </li>
                              ))
                            ) : (
                              <>
                                <li className="flex items-center gap-3">
                                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                  <span className="text-muted-foreground">{plan.credits} document checks</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                  <span className="text-muted-foreground">Non-Repository check</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                  <span className="text-muted-foreground">Similarity & AI reports</span>
                                </li>
                              </>
                            )}
                          </ul>
                          <Button
                            className="w-full"
                            variant={isPopular ? 'default' : 'outline'}
                            asChild
                          >
                            <Link to={linkData?.is_special ? '/auth?guest_special=true' : '/auth'}>
                              Sign Up to Purchase
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  });
                })()}
              </div>
            )}

            {/* No Repository = Safe to Submit Later */}
            <Card className="border-secondary/20 bg-gradient-to-br from-secondary/5 to-primary/5 p-6 sm:p-10">
              <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                <Lock className="h-7 w-7 text-secondary-foreground" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4 text-foreground leading-tight">
                No Repository = Safe to Submit Later
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-6">
                <span className="font-bold text-foreground">This is the key difference.</span> Your paper is NOT added to any database. Check your work here first, then submit to your university with complete confidence.
              </p>
              <ul className="space-y-3">
                {[
                  'Professor will never know you pre-checked',
                  'Zero self-plagiarism risk',
                  "Paper won't match against itself",
                  'Complete privacy guaranteed',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>

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
            Trading Name: PlagaiScans | Legal Entity: Plagaiscans Technologies Ltd (United Kingdom)
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

      {/* WhatsApp Support Button */}
      <WhatsAppSupportButton />
    </div>
  );
}
