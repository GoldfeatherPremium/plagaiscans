import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Eye, Loader2 } from 'lucide-react';

export default function MyDocuments() {
  const { documents, loading, downloadFile } = useDocuments();

  const handleDownloadDocument = (doc: Document) => {
    downloadFile(doc.file_path, 'documents');
  };

  const handleDownloadSimilarityReport = (doc: Document) => {
    if (doc.similarity_report_path) {
      downloadFile(doc.similarity_report_path, 'reports');
    }
  };

  const handleDownloadAIReport = (doc: Document) => {
    if (doc.ai_report_path) {
      downloadFile(doc.ai_report_path, 'reports');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">My Documents</h1>
          <p className="text-muted-foreground mt-1">
            View all your uploaded documents and their status
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first document to get started
              </p>
              <Button asChild>
                <a href="/dashboard/upload">Upload Document</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{doc.file_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()} at{' '}
                          {new Date(doc.uploaded_at).toLocaleTimeString()}
                        </p>
                        {doc.completed_at && (
                          <p className="text-sm text-muted-foreground">
                            Completed on {new Date(doc.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <StatusBadge status={doc.status} />
                    </div>
                  </div>

                  {doc.status === 'completed' && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Similarity Results */}
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">Similarity Check</h4>
                            <span className="text-2xl font-bold text-primary">
                              {doc.similarity_percentage}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${doc.similarity_percentage || 0}%` }}
                            />
                          </div>
                          {doc.similarity_report_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 w-full"
                              onClick={() => handleDownloadSimilarityReport(doc)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Report
                            </Button>
                          )}
                        </div>

                        {/* AI Detection Results */}
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">AI Detection</h4>
                            <span className="text-2xl font-bold text-secondary">
                              {doc.ai_percentage}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-secondary transition-all"
                              style={{ width: `${doc.ai_percentage || 0}%` }}
                            />
                          </div>
                          {doc.ai_report_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 w-full"
                              onClick={() => handleDownloadAIReport(doc)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Report
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {doc.status === 'pending' && (
                    <div className="mt-4 p-4 rounded-lg bg-accent/5 border border-accent/20">
                      <p className="text-sm text-muted-foreground">
                        Your document is in the queue and will be processed soon. You'll see the
                        results here once completed.
                      </p>
                    </div>
                  )}

                  {doc.status === 'in_progress' && (
                    <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        Your document is currently being processed. Check back soon for results.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}