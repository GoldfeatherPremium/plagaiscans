import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Upload, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function DocumentQueue() {
  const { documents, loading, downloadFile, uploadReport } = useDocuments();
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [similarityFile, setSimilarityFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [similarityPercent, setSimilarityPercent] = useState('');
  const [aiPercent, setAiPercent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingDocs = documents.filter((d) => d.status === 'pending' || d.status === 'in_progress');

  const handleSubmitReport = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    await uploadReport(
      selectedDoc.id,
      selectedDoc,
      similarityFile,
      aiFile,
      parseFloat(similarityPercent) || 0,
      parseFloat(aiPercent) || 0
    );
    setSubmitting(false);
    setSelectedDoc(null);
    setSimilarityFile(null);
    setAiFile(null);
    setSimilarityPercent('');
    setAiPercent('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Document Queue</h1>
          <p className="text-muted-foreground mt-1">Process pending documents</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : pendingDocs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No pending documents</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingDocs.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileText className="h-10 w-10 text-primary" />
                    <div>
                      <h3 className="font-semibold">{doc.file_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={doc.status} />
                    <Button variant="outline" size="sm" onClick={() => downloadFile(doc.file_path)}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setSelectedDoc(doc)}>
                          <Upload className="h-4 w-4 mr-2" /> Upload Report
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload Reports</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Similarity %</Label>
                            <Input type="number" min="0" max="100" value={similarityPercent} onChange={(e) => setSimilarityPercent(e.target.value)} />
                          </div>
                          <div>
                            <Label>Similarity Report (PDF)</Label>
                            <Input type="file" accept=".pdf" onChange={(e) => setSimilarityFile(e.target.files?.[0] || null)} />
                          </div>
                          <div>
                            <Label>AI Detection %</Label>
                            <Input type="number" min="0" max="100" value={aiPercent} onChange={(e) => setAiPercent(e.target.value)} />
                          </div>
                          <div>
                            <Label>AI Report (PDF)</Label>
                            <Input type="file" accept=".pdf" onChange={(e) => setAiFile(e.target.files?.[0] || null)} />
                          </div>
                          <Button className="w-full" onClick={handleSubmitReport} disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Complete & Submit'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}