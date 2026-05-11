import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function AdminExportStatus() {
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [token, setToken] = useState<string>("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { count, error } = await supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .not("ai_report_path", "is", null)
          .neq("ai_report_path", "");
        if (error) throw error;
        setTotalRows(count ?? 0);

        // Total bytes is unknown without iterating storage metadata; leave null.
        setTotalBytes(null);

        // Fetch masked token from a tiny edge call would be ideal, but to keep
        // things simple, we render a placeholder and let admin reveal locally.
        // The actual token value lives only in edge env. Show masked sentinel.
        setToken(""); // not exposed to client
      } catch (e: any) {
        toast({ title: "Failed to load status", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const listUrl = `${FN_BASE}/public-reports-list?limit=2`;
  const fileUrl = `${FN_BASE}/public-reports-file?path=<storage_path>`;

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: `${label} copied` });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Report Export Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Public outbound API for ingesting AI report PDFs into external pipelines.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Total report rows</span><span className="font-mono">{loading ? "…" : totalRows?.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total bytes</span><span className="font-mono text-muted-foreground">{totalBytes?.toLocaleString() ?? "n/a"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">List (paginated)</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-xs break-all">GET {listUrl}</code>
                <Button size="icon" variant="outline" onClick={() => copy(listUrl, "URL")}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">File (stream PDF)</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-xs break-all">GET {fileUrl}</code>
                <Button size="icon" variant="outline" onClick={() => copy(fileUrl, "URL")}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="text-muted-foreground text-xs">
              Both require header <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;INGEST_TOKEN&gt;</code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>INGEST_TOKEN</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              The token value is stored as a backend secret and is never exposed to the browser.
              Copy it from Cloud → Secrets, or rotate it there.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-2 rounded text-xs">
                {reveal ? (token || "(stored only in backend secrets)") : "••••••••••••••••••••"}
              </code>
              <Button size="icon" variant="outline" onClick={() => setReveal(v => !v)}>
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
