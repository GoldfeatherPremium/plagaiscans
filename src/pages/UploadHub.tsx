import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ServiceStatusBanner } from '@/components/ServiceStatusBanner';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, Sparkles, FileSearch, Bot, ArrowRight, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Provider = 'turnitin' | 'drillbit';

const UploadHub: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [open, setOpen] = useState<Provider | null>(null);

  const balances = {
    turnitinFull: profile?.credit_balance ?? 0,
    turnitinSim: profile?.similarity_credit_balance ?? 0,
    drillbitFull: (profile as { drillbit_credit_balance?: number } | null)?.drillbit_credit_balance ?? 0,
    drillbitSim: (profile as { drillbit_similarity_credit_balance?: number } | null)?.drillbit_similarity_credit_balance ?? 0,
  };

  const go = (path: string) => {
    setOpen(null);
    navigate(path);
  };

  const ProviderCard = ({
    title,
    description,
    accent,
    onStart,
    balanceFull,
    balanceSim,
  }: {
    title: string;
    description: string;
    accent: string;
    onStart: () => void;
    balanceFull: number;
    balanceSim: number;
  }) => (
    <Card className="border-2 hover:border-primary/40 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${accent}`} />
              {title}
            </CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Bot className="h-3 w-3" /> AI + Similarity
            </div>
            <div className="text-2xl font-semibold mt-1">{balanceFull}</div>
            <div className="text-xs text-muted-foreground">credits</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <FileSearch className="h-3 w-3" /> Similarity only
            </div>
            <div className="text-2xl font-semibold mt-1">{balanceSim}</div>
            <div className="text-xs text-muted-foreground">credits</div>
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={onStart}>
          Start scan <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <ServiceStatusBanner />

        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Start a new scan</h1>
          <p className="text-muted-foreground">Choose a detection provider, then pick what to check.</p>
        </div>

        <Tabs defaultValue="turnitin" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="turnitin" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Turnitin Detection
            </TabsTrigger>
            <TabsTrigger value="drillbit" className="gap-2">
              <Sparkles className="h-4 w-4" /> Drillbit Detection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="turnitin" className="mt-6">
            <ProviderCard
              title="Turnitin Detection"
              description="Industry-leading similarity and AI content analysis."
              accent="bg-primary"
              balanceFull={balances.turnitinFull}
              balanceSim={balances.turnitinSim}
              onStart={() => setOpen('turnitin')}
            />
          </TabsContent>

          <TabsContent value="drillbit" className="mt-6">
            <ProviderCard
              title="Drillbit Detection"
              description="Drillbit plagiarism and AI content analysis."
              accent="bg-orange-500"
              balanceFull={balances.drillbitFull}
              balanceSim={balances.drillbitSim}
              onStart={() => setOpen('drillbit')}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {open === 'turnitin' ? 'Turnitin' : 'Drillbit'} — choose detection type
            </DialogTitle>
            <DialogDescription>
              Select what you want to check this document for.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 mt-2">
            <button
              className="text-left rounded-lg border-2 p-4 hover:border-primary transition-colors"
              onClick={() =>
                go(open === 'turnitin' ? '/dashboard/upload-similarity' : '/dashboard/upload-drillbit-similarity')
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <FileSearch className="h-4 w-4" /> Plagiarism only
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Similarity check without AI content detection.
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Coins className="h-3 w-3" />
                  {open === 'turnitin' ? balances.turnitinSim : balances.drillbitSim}
                </Badge>
              </div>
            </button>

            <button
              className="text-left rounded-lg border-2 p-4 hover:border-primary transition-colors"
              onClick={() =>
                go(open === 'turnitin' ? '/dashboard/upload' : '/dashboard/upload-drillbit')
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4" /> Plagiarism + AI detection
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Full check including AI-generated content analysis.
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Coins className="h-3 w-3" />
                  {open === 'turnitin' ? balances.turnitinFull : balances.drillbitFull}
                </Badge>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UploadHub;
