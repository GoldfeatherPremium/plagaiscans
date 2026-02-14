import React, { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Upload, FileText, AlertCircle, CheckCircle, Info, ArrowRight, X, Bell, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function UploadDocument() {
  const { t } = useTranslation('dashboard');
  const { profile } = useAuth();
  const { uploadDocuments } = useDocuments();
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    isLoading: pushLoading,
    permission: pushPermission,
    subscribe: subscribePush,
    sendLocalNotification 
  } = usePushNotifications();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number } | null>(null);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  
  const [excludeBibliographic, setExcludeBibliographic] = useState(true);
  const [excludeQuoted, setExcludeQuoted] = useState(false);
  const [excludeSmallSources, setExcludeSmallSources] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const creditBalance = profile?.credit_balance || 0;
  const similarityCreditBalance = profile?.similarity_credit_balance || 0;
  const maxFilesAllowed = creditBalance;

  // Redirect users who only have similarity credits to the similarity upload page
  React.useEffect(() => {
    const hasFullCredits = creditBalance > 0;
    const hasSimilarityCredits = similarityCreditBalance > 0;
    
    // If user has ONLY similarity credits, redirect them
    if (!hasFullCredits && hasSimilarityCredits) {
      toast.info('You have similarity credits only. Redirecting to similarity upload...');
      navigate('/dashboard/upload-similarity', { replace: true });
    }
  }, [creditBalance, similarityCreditBalance, navigate]);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    setUploadResults(null);

    setSelectedFiles((prev) => {
      // Avoid accidentally re-adding the same file multiple times
      const existingKeys = new Set(prev.map((f) => `${f.name}::${f.size}::${f.lastModified}`));
      const deduped = newFiles.filter((f) => !existingKeys.has(`${f.name}::${f.size}::${f.lastModified}`));

      const maxAllowed = Math.max(0, maxFilesAllowed);
      const availableSlots = Math.max(0, maxAllowed - prev.length);
      const filesToAdd = deduped.slice(0, availableSlots);
      return [...prev, ...filesToAdd];
    });

    // Ensure the file input doesn't keep an old FileList around
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    const results = await uploadDocuments(
      selectedFiles,
      (current, total) => {
        setUploadProgress({ current, total });
      },
      { 
        uploadType: 'single',
        exclusions: {
          exclude_bibliography: excludeBibliographic,
          exclude_quotes: excludeQuoted,
          exclude_small_sources: excludeSmallSources,
        }
      }
    );

    setUploading(false);
    setUploadResults(results);
    setSelectedFiles([]);
    if (inputRef.current) inputRef.current.value = '';
    
    // Show push notification prompt after successful upload if not subscribed
    if (results.success > 0 && pushSupported && !pushSubscribed && pushPermission !== 'denied') {
      setShowPushPrompt(true);
    }
  };

  const handleEnablePush = async () => {
    const success = await subscribePush();
    if (success) {
      toast.success('Push notifications enabled!');
      setShowPushPrompt(false);
      setTimeout(() => {
        sendLocalNotification('Notifications Enabled! 🎉', {
          body: 'You will now be notified when your documents are ready.',
        });
      }, 1000);
    } else {
      toast.error('Failed to enable notifications');
    }
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    if (inputRef.current) inputRef.current.value = '';
    navigate('/dashboard/documents');
  };

  const hasCredits = creditBalance >= 1;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">{t('upload.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('upload.subtitle')}
          </p>
        </div>

        {/* Credit Check */}
        {!hasCredits && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Insufficient Credits</p>
                <p className="text-sm text-muted-foreground">
                  You need at least 1 credit to upload a document
                </p>
              </div>
              <Button asChild>
                <Link to="/dashboard/credits">Buy Credits</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Results */}
        {uploadResults && (
          <Card className="border-secondary bg-secondary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-secondary" />
              <div className="flex-1">
                <p className="font-medium text-secondary">
                  {uploadResults.success} Document{uploadResults.success !== 1 ? 's' : ''} Uploaded Successfully!
                </p>
                <p className="text-sm text-muted-foreground">
                  {uploadResults.failed > 0 && `${uploadResults.failed} failed. `}
                  Your documents are now in the queue and will be processed soon.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/dashboard/documents">View Documents</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Push Notification Prompt after Upload */}
        {showPushPrompt && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Get notified when your documents are ready!</p>
                    <p className="text-sm text-muted-foreground">
                      Enable push notifications to receive instant updates.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowPushPrompt(false)}>
                    Not now
                  </Button>
                  <Button size="sm" onClick={handleEnablePush} disabled={pushLoading}>
                    {pushLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    Enable Notifications
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Uploading documents...</p>
                <p className="text-sm text-muted-foreground">
                  {uploadProgress.current} / {uploadProgress.total}
                </p>
              </div>
              <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
            </CardContent>
          </Card>
        )}


        {/* Options (exclusion) */}
        <div className="space-y-4">
          <Label className="text-base">Options ( exclusion )</Label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="exclude-bibliographic" className="font-normal cursor-pointer">
                Exclude bibliographic materials
              </Label>
              <Switch
                id="exclude-bibliographic"
                checked={excludeBibliographic}
                onCheckedChange={setExcludeBibliographic}
                disabled={!hasCredits}
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
                disabled={!hasCredits}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="exclude-small" className="font-normal cursor-pointer">
                Exclude small sources (Small match exclusion type)
              </Label>
              <Switch
                id="exclude-small"
                checked={excludeSmallSources}
                onCheckedChange={setExcludeSmallSources}
                disabled={!hasCredits}
              />
            </div>
          </div>
        </div>

        {/* Document Upload Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">Documents</Label>
            <span className="text-sm text-muted-foreground">
              {selectedFiles.length} / {maxFilesAllowed} files selected
            </span>
          </div>
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${!hasCredits || selectedFiles.length >= maxFilesAllowed ? 'opacity-50 pointer-events-none' : ''}`}
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
              disabled={!hasCredits || selectedFiles.length >= maxFilesAllowed}
              multiple
            />
            
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Drag and drop files here</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>You can upload up to <strong className="text-foreground">{maxFilesAllowed} files</strong> based on your credits</p>
                <p>Each file must be less than <strong className="text-foreground">100 MB</strong></p>
                <p>Supported file types:</p>
                <p className="text-amber-600 dark:text-amber-500">.docx, .xlsx, .pptx, .ps, .pdf, .html, .rtf, .odt, .hwp, .txt</p>
              </div>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 mt-4">
              <Label className="text-sm">Selected Files ({selectedFiles.length})</Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notices */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              The file you are submitting will not be added to any repository.
            </p>
          </div>
        </div>

        {/* Credit Info */}
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cost per document</p>
              <p className="text-xs text-muted-foreground">Includes similarity report and content analysis</p>
            </div>
            <p className="text-xl font-bold">1 Credit</p>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <p className="text-sm">Your balance</p>
            <p className="font-semibold">{creditBalance} Credits</p>
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-sm">Total cost</p>
              <p className="font-semibold text-primary">{selectedFiles.length} Credit{selectedFiles.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!hasCredits || selectedFiles.length === 0 || uploading}
            className="gap-2"
          >
            {uploading ? 'Submitting...' : `Submit ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
            {!uploading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
