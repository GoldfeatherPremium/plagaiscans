import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Check, X, AlertCircle, Trash2, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from "jszip";

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  filePath?: string;
}

interface MappingResult {
  reportFileName: string;
  documentFileName: string;
  documentId: string;
  mappingKey: string;
}

interface ProcessingResult {
  mapped: MappingResult[];
  unmapped: string[];
  stats: {
    totalReports: number;
    mapped: number;
    unmapped: number;
  };
}

// Extract mapping key: remove last 6-7 alphabet characters from filename (ignoring extension)
function extractMappingKey(filename: string): string {
  // Remove extension
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  // Find trailing alphabet characters
  const match = baseName.match(/([a-zA-Z]+)$/);
  if (!match) {
    // No trailing alphabets, return normalized base name
    return baseName.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  const trailingAlphabets = match[1];
  
  // Remove 6-7 trailing alphabet characters
  let charsToRemove = 0;
  if (trailingAlphabets.length >= 7) {
    charsToRemove = 7;
  } else if (trailingAlphabets.length >= 6) {
    charsToRemove = 6;
  } else {
    // Less than 6 trailing alphabets, remove all of them
    charsToRemove = trailingAlphabets.length;
  }
  
  const key = baseName.slice(0, baseName.length - charsToRemove);
  
  // Normalize: lowercase, trim, normalize spaces
  return key.toLowerCase().trim().replace(/\s+/g, ' ');
}

export default function AdminSimilarityBulkUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const processFiles = async (incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles);
    const newFiles: UploadFile[] = [];

    for (const file of fileArray) {
      // Handle ZIP files
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          
          for (const [name, zipEntry] of Object.entries(contents.files)) {
            if (!zipEntry.dir && name.toLowerCase().endsWith('.pdf')) {
              const blob = await zipEntry.async('blob');
              const extractedFile = new File([blob], name.split('/').pop() || name, { type: 'application/pdf' });
              newFiles.push({ file: extractedFile, status: 'pending' });
            }
          }
        } catch (error) {
          toast.error(`Failed to extract ZIP: ${file.name}`);
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        newFiles.push({ file, status: 'pending' });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setProcessingResult(null);
    setUploadProgress(0);
  };

  const uploadAndProcess = async () => {
    if (files.length === 0) {
      toast.error("No files selected");
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setProcessingResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Authentication required");
        return;
      }

      const uploadedReports: { fileName: string; filePath: string; mappingKey: string }[] = [];
      const totalFiles = files.length;

      // Upload all files to storage
      for (let i = 0; i < files.length; i++) {
        const uploadFile = files[i];
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' } : f
        ));

        const timestamp = Date.now();
        const filePath = `similarity-reports/${timestamp}_${uploadFile.file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(filePath, uploadFile.file);

        if (uploadError) {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'error', error: uploadError.message } : f
          ));
          continue;
        }

        const mappingKey = extractMappingKey(uploadFile.file.name);
        uploadedReports.push({
          fileName: uploadFile.file.name,
          filePath,
          mappingKey
        });

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploaded', filePath } : f
        ));

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      }

      if (uploadedReports.length === 0) {
        toast.error("No files uploaded successfully");
        setIsProcessing(false);
        return;
      }

      // Call edge function for auto-mapping
      setUploadProgress(60);
      
      const { data, error } = await supabase.functions.invoke('similarity-auto-map', {
        body: { reports: uploadedReports }
      });

      if (error) {
        console.error("Mapping error:", error);
        toast.error("Failed to auto-map reports");
        setIsProcessing(false);
        return;
      }

      setUploadProgress(100);
      setProcessingResult(data);
      
      if (data.stats.mapped > 0) {
        toast.success(`Successfully mapped ${data.stats.mapped} report(s)`);
      }
      if (data.stats.unmapped > 0) {
        toast.warning(`${data.stats.unmapped} report(s) could not be matched`);
      }

    } catch (error) {
      console.error("Processing error:", error);
      toast.error("An error occurred during processing");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Similarity Bulk Upload</h1>
          <p className="text-muted-foreground">
            Upload similarity report PDFs to auto-map to documents
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Similarity Reports
            </CardTitle>
            <CardDescription>
              Drop PDF files or ZIP archives. Reports will be auto-mapped using filename matching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg mb-2">Drag & drop PDF files or ZIP archives</p>
              <p className="text-sm text-muted-foreground mb-4">Only PDF files are processed for similarity reports</p>
              <input
                type="file"
                accept=".pdf,.zip"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <Button asChild variant="outline">
                <label htmlFor="file-input" className="cursor-pointer">
                  Browse Files
                </label>
              </Button>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{files.length} file(s) selected</h3>
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
                
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {files.map((uploadFile, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{uploadFile.file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadFile.status === 'pending' && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                        {uploadFile.status === 'uploading' && (
                          <Badge variant="default">Uploading...</Badge>
                        )}
                        {uploadFile.status === 'uploaded' && (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Uploaded
                          </Badge>
                        )}
                        {uploadFile.status === 'error' && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                        {uploadFile.status === 'pending' && (
                          <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-sm text-center text-muted-foreground">
                      {uploadProgress < 50 ? 'Uploading files...' : 'Mapping reports...'}
                    </p>
                  </div>
                )}

                {/* Upload Button */}
                {!isProcessing && (
                  <Button 
                    onClick={uploadAndProcess} 
                    className="w-full"
                    disabled={files.every(f => f.status !== 'pending')}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    Upload & Auto-Map
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {processingResult && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
              <CardDescription>
                {processingResult.stats.mapped} mapped, {processingResult.stats.unmapped} unmatched
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{processingResult.stats.totalReports}</p>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{processingResult.stats.mapped}</p>
                  <p className="text-sm text-muted-foreground">Mapped</p>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{processingResult.stats.unmapped}</p>
                  <p className="text-sm text-muted-foreground">Unmatched</p>
                </div>
              </div>

              {/* Mapped Reports */}
              {processingResult.mapped.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Successfully Mapped ({processingResult.mapped.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {processingResult.mapped.map((result, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-green-500/5 rounded">
                        <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="truncate flex-1">{result.reportFileName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="truncate flex-1">{result.documentFileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched Reports */}
              {processingResult.unmapped.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Unmatched Reports ({processingResult.unmapped.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {processingResult.unmapped.map((fileName, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-orange-500/5 rounded">
                        <FileText className="h-4 w-4 text-orange-500" />
                        <span className="truncate">{fileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mapping Rule Info */}
        <Card>
          <CardHeader>
            <CardTitle>Filename Mapping Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>The system automatically maps reports to documents using this rule:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Remove the file extension</li>
              <li>Remove the last 6-7 alphabet characters from the filename</li>
              <li>The remaining text becomes the mapping key</li>
              <li>Match with documents that have the same mapping key</li>
            </ol>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Example:</p>
              <p className="text-muted-foreground">
                Document: <code className="bg-background px-1 rounded">thesis work 2024 abc.docx</code>
              </p>
              <p className="text-muted-foreground">
                Report: <code className="bg-background px-1 rounded">thesis work 2024.pdf</code>
              </p>
              <p className="text-muted-foreground mt-1">
                Mapping key: <code className="bg-background px-1 rounded">thesis work 2024</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
