import React, { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, FileText, AlertCircle, CheckCircle, Info, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function UploadDocument() {
  const { profile } = useAuth();
  const { uploadDocument } = useDocuments();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  const [excludeBibliographic, setExcludeBibliographic] = useState(true);
  const [excludeQuoted, setExcludeQuoted] = useState(false);
  const [excludeSmallSources, setExcludeSmallSources] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    const { success } = await uploadDocument(selectedFile);
    setUploading(false);
    
    if (success) {
      setUploadSuccess(true);
      setSelectedFile(null);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    navigate('/dashboard/documents');
  };

  const hasCredits = (profile?.credit_balance || 0) >= 1;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Add new submission</h1>
          <p className="text-muted-foreground mt-1">
            Please fill out the following fields to submit your document for plagiarism checking. Each field is important to ensure your document is processed accurately.
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
              <Button variant="outline" asChild>
                <Link to="/dashboard/documents">View Documents</Link>
              </Button>
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
          <Label className="text-base">Document</Label>
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${!hasCredits ? 'opacity-50 pointer-events-none' : ''}`}
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
              disabled={!hasCredits}
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
                  <p>Uploaded file must has less than <strong className="text-foreground">800 pages</strong></p>
                  <p>Files must contain <strong className="text-foreground">over 20 words</strong> for a similarity report</p>
                  <p>Supported file types for generating reports:</p>
                  <p className="text-amber-600 dark:text-amber-500">.docx, .xlsx, .pptx, .ps, .pdf, .html, .rtf, .odt, .hwp, .txt</p>
                </div>
              </div>
            )}
          </div>
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
              <p className="text-xs text-muted-foreground">Includes similarity + AI detection</p>
            </div>
            <p className="text-xl font-bold">1 Credit</p>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <p className="text-sm">Your balance</p>
            <p className="font-semibold">{profile?.credit_balance || 0} Credits</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!hasCredits || !selectedFile || uploading}
            className="gap-2"
          >
            {uploading ? 'Submitting...' : 'Submit'}
            {!uploading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
