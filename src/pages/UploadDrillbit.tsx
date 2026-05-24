import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ServiceStatusBanner } from '@/components/ServiceStatusBanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments } from '@/hooks/useDocuments';
import { toast } from 'sonner';

const ALLOWED_EXT = /\.(pdf|docx|txt|rtf|odt)$/i;

const UploadDrillbit: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { uploadDocuments } = useDocuments();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const balance =
    (profile as { drillbit_credit_balance?: number } | null)?.drillbit_credit_balance ?? 0;

  const addFiles = (incoming: File[]) => {
    const rejected = incoming.filter((f) => !ALLOWED_EXT.test(f.name));
    if (rejected.length) {
      toast.error(`Unsupported file types: ${rejected.map((f) => f.name).join(', ')}`);
    }
    const valid = incoming.filter((f) => ALLOWED_EXT.test(f.name));
    const room = Math.max(0, balance - files.length);
    if (valid.length > room) {
      toast.error(`You can only upload ${room} more file(s) with your current Drillbit credits.`);
    }
    setFiles((prev) => [...prev, ...valid.slice(0, room)]);
    setResults(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async () => {
    if (!files.length) return;
    setUploading(true);
    setProgress({ current: 0, total: files.length });
    const res = await uploadDocuments(
      files,
      (c, t) => setProgress({ current: c, total: t }),
      { uploadType: files.length > 1 ? 'bulk' : 'single', scanType: 'drillbit_full' }
    );
    setResults(res);
    setUploading(false);
    if (res.success > 0) {
      setFiles([]);
      setTimeout(() => navigate('/dashboard/documents'), 1500);
    }
  };

  if (balance < 1) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-orange-500" />
              <h2 className="text-2xl font-bold">No Drillbit (AI + Similarity) credits</h2>
              <p className="text-muted-foreground">
                You need at least 1 Drillbit AI + Similarity credit to upload here.
              </p>
              <div className="flex gap-2 justify-center">
                <Button asChild>
                  <Link to="/dashboard/credits">Buy credits</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard/scan">Back</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <ServiceStatusBanner />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-orange-500" />
              Drillbit — Plagiarism + AI
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload documents for Drillbit similarity and AI content analysis.
            </p>
          </div>
          <div className="rounded-lg bg-orange-500/10 px-3 py-2 text-orange-600 dark:text-orange-400 font-semibold">
            {balance} credits
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
              }`}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">.pdf, .docx, .txt, .rtf, .odt</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.rtf,.odt"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">{files.length} file(s) selected</div>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{f.name}</span>
                    <button
                      onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                      disabled={uploading}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Uploading {progress.current} / {progress.total}…
                </div>
                <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} />
              </div>
            )}

            {results && (
              <div className="rounded-lg border p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="text-sm">
                  {results.success} uploaded{results.failed > 0 ? `, ${results.failed} failed` : ''}.
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => navigate('/dashboard/scan')} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!files.length || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Upload {files.length > 0 ? `(${files.length})` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadDrillbit;
