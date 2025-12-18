import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments } from '@/hooks/useDocuments';
import { FileText, Clock, CheckCircle, CreditCard, Upload, Users, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/StatusBadge';

export default function Dashboard() {
  const { role, profile } = useAuth();
  const { documents } = useDocuments();

  const stats = {
    pending: documents.filter((d) => d.status === 'pending').length,
    inProgress: documents.filter((d) => d.status === 'in_progress').length,
    completed: documents.filter((d) => d.status === 'completed').length,
    total: documents.length,
  };

  const recentDocs = documents.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === 'customer'
              ? 'Manage your documents and track their status'
              : role === 'staff'
              ? 'View and process assigned documents'
              : 'Overview of platform activity'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {role === 'customer' && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Balance</p>
                    <p className="text-2xl font-bold">{profile?.credit_balance || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {role === 'customer' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <Link to="/dashboard/upload">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center">
                    <Upload className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Upload Document</h3>
                    <p className="text-sm text-muted-foreground">
                      Submit a new document for checking
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <Link to="/dashboard/credits">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl gradient-success flex items-center justify-center">
                    <CreditCard className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Buy Credits</h3>
                    <p className="text-sm text-muted-foreground">
                      Purchase more credits via WhatsApp
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        )}

        {/* Recent Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>
                {role === 'customer' ? 'Your latest uploads' : 'Latest document activity'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={role === 'customer' ? '/dashboard/documents' : '/dashboard/queue'}>
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No documents yet</p>
                {role === 'customer' && (
                  <Button className="mt-4" asChild>
                    <Link to="/dashboard/upload">Upload Your First Document</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {doc.status === 'completed' && (
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">
                            Similarity: <span className="font-medium text-foreground">{doc.similarity_percentage}%</span>
                          </p>
                          <p className="text-muted-foreground">
                            AI: <span className="font-medium text-foreground">{doc.ai_percentage}%</span>
                          </p>
                        </div>
                      )}
                      <StatusBadge status={doc.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}