import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { SEO } from '@/components/SEO';

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reseller-api`;

const CodeBlock = ({ children, lang = 'bash' }: { children: string; lang?: string }) => (
  <pre className="bg-muted/60 border border-border rounded-md p-4 text-xs overflow-x-auto">
    <code className={`language-${lang}`}>{children}</code>
  </pre>
);

const Endpoint = ({ method, path, desc }: { method: string; path: string; desc: string }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
    <Badge variant={method === 'POST' ? 'default' : 'secondary'} className="font-mono text-xs">{method}</Badge>
    <code className="font-mono text-sm text-foreground">{path}</code>
    <span className="text-sm text-muted-foreground ml-auto">{desc}</span>
  </div>
);

export default function ApiDocs() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Reseller API Documentation | PlagaiScans"
        description="Integrate PlagaiScans AI Content Analysis into your platform. REST API with prepaid credits, signed webhooks, and polling."
      />
      <Navigation />

      <main className="container-width section-padding pt-24 pb-16 max-w-4xl mx-auto">
        <header className="mb-10">
          <Badge variant="secondary" className="mb-3">For Resellers & Partners</Badge>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Reseller API</h1>
          <p className="text-lg text-muted-foreground">
            Programmatically submit documents from your own platform and receive both
            <strong> AI content</strong> and <strong>Similarity</strong> reports.
            Prepaid credits, signed webhooks, and polling — built for production reseller integrations.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            To request access, <Link to="/contact" className="text-primary hover:underline">contact us</Link>.
            Once approved, your account manager will provide an API key and configure your webhook URL.
          </p>
        </header>

        <Card className="mb-8">
          <CardHeader><CardTitle>Base URL</CardTitle></CardHeader>
          <CardContent><CodeBlock>{BASE}</CodeBlock></CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>All requests must include your API key in the <code className="bg-muted px-1.5 py-0.5 rounded">X-API-Key</code> header.</p>
            <CodeBlock>{`curl -H "X-API-Key: psk_live_xxxxxxxxxxxxxxxx" \\
  ${BASE}/account`}</CodeBlock>
            <p className="text-muted-foreground">
              Keep your key secret. If compromised, contact support to revoke and rotate it immediately.
              Rate limit: <strong>60 requests / minute</strong> per key (configurable per reseller).
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>Endpoints</CardTitle></CardHeader>
          <CardContent>
            <Endpoint method="POST" path="/scans" desc="Submit a document for AI analysis" />
            <Endpoint method="GET" path="/scans" desc="List your scans (paginated)" />
            <Endpoint method="GET" path="/scans/:id" desc="Get scan status & report URL" />
            <Endpoint method="GET" path="/scans/:id/report" desc="302 redirect to signed PDF report" />
            <Endpoint method="GET" path="/account" desc="Account info & credit balance" />
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>POST /scans — Submit a document</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>Multipart form upload. Costs <strong>1 credit</strong> per submission. Each submission returns <strong>both an AI report and a Similarity report</strong>. Returns immediately with <code>scan_id</code>.</p>
            <div>
              <h4 className="font-semibold mb-2">Form fields</h4>
              <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                <li><code>file</code> (required) — pdf, docx, odt, rtf, txt, html. Max 50 MB. <code>.doc</code> not supported.</li>
                <li><code>external_reference</code> (optional) — your internal ID, returned in webhooks.</li>
                <li><code>exclude_bibliography</code> — <code>true</code>/<code>false</code></li>
                <li><code>exclude_quotes</code> — <code>true</code>/<code>false</code></li>
                <li><code>exclude_citations</code> — <code>true</code>/<code>false</code></li>
                <li><code>exclude_small_matches_words</code> — integer (e.g. <code>8</code>)</li>
              </ul>
            </div>
            <CodeBlock>{`curl -X POST ${BASE}/scans \\
  -H "X-API-Key: psk_live_xxxxxxxxxxxxxxxx" \\
  -F "file=@./essay.pdf" \\
  -F "external_reference=order_12345" \\
  -F "exclude_bibliography=true" \\
  -F "exclude_quotes=true" \\
  -F "exclude_citations=true" \\
  -F "exclude_small_matches_words=8"`}</CodeBlock>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <h4 className="font-semibold mb-2">Similarity filters</h4>
              <p className="text-muted-foreground mb-2">
                These optional filters are stored with the scan and forwarded to our analysis engine,
                so the generated report respects your exclusions. Defaults to <em>none excluded</em>.
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
                <li><code>exclude_bibliography</code> — skip bibliography/references section</li>
                <li><code>exclude_quotes</code> — skip text wrapped in quotation marks</li>
                <li><code>exclude_citations</code> — skip in-text citations</li>
                <li><code>exclude_small_matches_words</code> — minimum word count threshold; matches under this size are ignored (e.g. <code>8</code>)</li>
              </ul>
            </div>
            <CodeBlock lang="json">{`{
  "scan_id": "9f3c...",
  "external_reference": "order_12345",
  "status": "queued",
  "file_name": "essay.pdf",
  "credit_balance": 99,
  "created_at": "2026-05-01T18:00:00Z"
}`}</CodeBlock>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>GET /scans/:id — Poll for results</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Poll every 30–60 seconds until <code>status</code> is <code>completed</code> or <code>failed</code>.</p>
            <CodeBlock>{`curl -H "X-API-Key: psk_live_xxx" ${BASE}/scans/9f3c...`}</CodeBlock>
            <CodeBlock lang="json">{`{
  "scan_id": "9f3c...",
  "external_reference": "order_12345",
  "file_name": "essay.pdf",
  "status": "completed",
  "ai_percentage": 23,
  "similarity_percentage": 15,
  "ai_report_url": "https://.../ai-report-signed.pdf",
  "similarity_report_url": "https://.../similarity-report-signed.pdf",
  "report_url": "https://.../ai-report-signed.pdf",
  "created_at": "2026-05-01T18:00:00Z",
  "completed_at": "2026-05-01T18:08:00Z"
}`}</CodeBlock>
            <p className="text-muted-foreground">
              <code>ai_report_url</code> and <code>similarity_report_url</code> are signed URLs valid for 1 hour.
              Re-fetch the scan to get fresh URLs. <code>report_url</code> is a backward-compatible alias for the AI report.
              Statuses: <code>queued</code> → <code>in_progress</code> → <code>completed</code> | <code>failed</code>.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>Webhooks (recommended)</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              When configured, we POST to your webhook URL on completion or failure.
              Retries with exponential backoff (1m, 5m, 30m, 2h, 12h) up to 5 attempts.
            </p>
            <div>
              <h4 className="font-semibold mb-2">Payload</h4>
              <CodeBlock lang="json">{`{
  "scan_id": "9f3c...",
  "external_reference": "order_12345",
  "status": "completed",
  "ai_percentage": 23,
  "file_name": "essay.pdf",
  "report_url": "https://.../signed-url-valid-1h.pdf",
  "completed_at": "2026-05-01T18:08:00Z"
}`}</CodeBlock>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Signature verification</h4>
              <p className="mb-2">Each request includes <code>X-PlagaiScans-Signature: sha256=&lt;hex&gt;</code> — HMAC-SHA256 of the raw body using your webhook secret.</p>
              <CodeBlock lang="javascript">{`import crypto from 'crypto';

function verify(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}`}</CodeBlock>
            </div>
            <p className="text-muted-foreground">
              Respond with HTTP 2xx within 30s to acknowledge. Any other response triggers a retry.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>Credits & Billing</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Reseller accounts use a <strong>prepaid credit pool</strong>. 1 credit = 1 AI scan.</p>
            <p>Failed scans are <strong>automatically refunded</strong> to your balance.</p>
            <p>Top-ups are managed by your account manager. Check your balance anytime via <code>GET /account</code>.</p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Status</th><th className="py-2">Meaning</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                <tr><td className="py-2 pr-4 font-mono">400</td><td>Bad request (invalid file, missing field)</td></tr>
                <tr><td className="py-2 pr-4 font-mono">401</td><td>Missing or invalid API key</td></tr>
                <tr><td className="py-2 pr-4 font-mono">402</td><td>Insufficient credits</td></tr>
                <tr><td className="py-2 pr-4 font-mono">403</td><td>Account suspended</td></tr>
                <tr><td className="py-2 pr-4 font-mono">404</td><td>Scan not found</td></tr>
                <tr><td className="py-2 pr-4 font-mono">429</td><td>Rate limit exceeded</td></tr>
                <tr><td className="py-2 pr-4 font-mono">500</td><td>Internal error — safe to retry</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <div className="text-center text-sm text-muted-foreground">
          Questions? <Link to="/contact" className="text-primary hover:underline">Contact our team</Link>.
        </div>
      </main>

      <Footer />
    </div>
  );
}
