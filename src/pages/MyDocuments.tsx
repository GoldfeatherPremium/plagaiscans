import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function MyDocuments() {
  const { documents, loading, downloadFile } = useDocuments();

  const handleDownloadSimilarityReport = (doc: Document) => {
    if (doc.similarity_report_path) {
      const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
      downloadFile(doc.similarity_report_path, 'reports', `${baseName}_similarity.pdf`);
    }
  };

  const handleDownloadAIReport = (doc: Document) => {
    if (doc.ai_report_path) {
      const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
      downloadFile(doc.ai_report_path, 'reports', `${baseName}_ai.pdf`);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc, index) => {
                      const { date, time } = formatDateTime(doc.uploaded_at);
                      return (
                        <TableRow key={doc.id}>
                          <TableCell className="text-center font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-medium truncate max-w-[200px]" title={doc.file_name}>
                                {doc.file_name}
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
                            <StatusBadge status={doc.status} />
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.status === 'completed' ? (
                              <span className="font-semibold text-primary">
                                {doc.similarity_percentage}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.status === 'completed' ? (
                              <span className="font-semibold text-secondary">
                                {doc.ai_percentage}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.similarity_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadSimilarityReport(doc)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.ai_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadAIReport(doc)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {doc.remarks ? (
                              <span className="text-sm text-foreground">{doc.remarks}</span>
                            ) : doc.error_message ? (
                              <span className="text-sm text-destructive">{doc.error_message}</span>
                            ) : doc.status === 'pending' ? (
                              <span className="text-sm text-muted-foreground">In queue</span>
                            ) : doc.status === 'in_progress' ? (
                              <span className="text-sm text-muted-foreground">Processing...</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
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
      </div>
    </DashboardLayout>
  );
}
