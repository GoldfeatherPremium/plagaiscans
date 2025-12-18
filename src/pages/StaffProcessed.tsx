import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function StaffProcessed() {
  const { documents, loading, downloadFile } = useDocuments();
  const { user } = useAuth();

  // Filter to only show documents processed by this staff member
  const myProcessedDocs = documents.filter(
    (d) => d.assigned_staff_id === user?.id && d.status === 'completed'
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">My Processed Documents</h1>
          <p className="text-muted-foreground mt-1">
            Documents you have completed processing
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : myProcessedDocs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No processed documents</h3>
              <p className="text-muted-foreground">
                Documents you complete will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {myProcessedDocs.map((doc) => (
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
                          Completed on {new Date(doc.completed_at!).toLocaleDateString()}
                        </p>
                        <div className="flex gap-4 mt-1 text-sm">
                          <span>Similarity: <strong>{doc.similarity_percentage}%</strong></span>
                          <span>AI: <strong>{doc.ai_percentage}%</strong></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => downloadFile(doc.file_path)}
                      >
                        <Download className="h-4 w-4 mr-2" /> Document
                      </Button>
                    </div>
                  </div>

                  {doc.error_message && (
                    <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Error Reported</p>
                        <p className="text-sm text-muted-foreground">{doc.error_message}</p>
                      </div>
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
