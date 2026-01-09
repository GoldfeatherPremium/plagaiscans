import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { 
  Download, 
  Chrome, 
  Settings, 
  Key, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ExternalLink,
  FileText,
  RefreshCw,
  Zap
} from "lucide-react";

const ExtensionSetup = () => {
  const [apiToken, setApiToken] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const handleDownload = () => {
    // In production, this would download the extension ZIP
    toast({
      title: "Download Starting",
      description: "The extension ZIP file will be downloaded shortly.",
    });
    // Create a simple download trigger for the extension files
    // This would be replaced with actual file hosting
    window.open("https://github.com/your-repo/turnitin-extension/releases/latest", "_blank");
  };

  const copyApiEndpoint = () => {
    const endpoint = `${window.location.origin}/api/extension`;
    navigator.clipboard.writeText(endpoint);
    toast({ title: "Copied", description: "API endpoint copied to clipboard" });
  };

  const copyToken = () => {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken);
      toast({ title: "Copied", description: "Token copied to clipboard" });
    }
  };

  const testConnection = async () => {
    if (!apiToken) {
      toast({
        title: "Missing Token",
        description: "Please enter your API token first",
        variant: "destructive",
      });
      return;
    }

    setTestStatus("testing");

    try {
      // Test the connection with a heartbeat
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extension-api/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ browser_info: "Test from setup page" }),
      });

      if (response.ok) {
        setTestStatus("success");
        toast({
          title: "Connection Successful",
          description: "Your token is valid and working!",
        });
      } else {
        setTestStatus("error");
        const error = await response.json();
        toast({
          title: "Connection Failed",
          description: error.error || "Invalid token or server error",
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestStatus("error");
      toast({
        title: "Connection Error",
        description: "Could not connect to the server",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <SEO title="Extension Setup" description="Set up the Turnitin automation Chrome extension" />

      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Chrome Extension Setup</h1>
          <p className="text-muted-foreground">
            Follow these steps to install and configure the Turnitin automation extension
          </p>
        </div>

        {/* Overview Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              What This Extension Does
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              The Chrome extension automatically processes documents from the <strong>Similarity Queue</strong>:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Fetches pending similarity-only documents from the queue</li>
              <li>Uploads them to your configured Turnitin slots</li>
              <li>Waits for processing and captures the similarity report</li>
              <li>Uploads the report back and marks the document as completed</li>
              <li>Automatically moves to the next pending document</li>
            </ul>
          </CardContent>
        </Card>

        {/* Step-by-step instructions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Installation Steps</h2>

          <Accordion type="single" collapsible className="space-y-2">
            {/* Step 1: Download */}
            <AccordionItem value="step-1" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">1</Badge>
                  <span>Download the Extension</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Download the Chrome extension package (ZIP file) to your computer.
                </p>
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Extension ZIP
                </Button>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Extract the ZIP file to a folder you'll remember (e.g., Documents/turnitin-extension)
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            {/* Step 2: Install in Chrome */}
            <AccordionItem value="step-2" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
                  <span>Install in Chrome</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <ol className="text-sm space-y-3 list-decimal list-inside text-muted-foreground">
                  <li>
                    Open Chrome and go to{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">chrome://extensions/</code>
                  </li>
                  <li>
                    Enable <strong>"Developer mode"</strong> using the toggle in the top-right corner
                  </li>
                  <li>
                    Click <strong>"Load unpacked"</strong> button
                  </li>
                  <li>
                    Select the extracted extension folder
                  </li>
                  <li>
                    The extension icon <Chrome className="h-4 w-4 inline" /> should appear in your toolbar
                  </li>
                </ol>
                <Button variant="outline" asChild className="gap-2">
                  <a href="chrome://extensions/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open Chrome Extensions
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Step 3: Configure */}
            <AccordionItem value="step-3" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">3</Badge>
                  <span>Configure the Extension</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Right-click the extension icon and select "Options" to configure:
                </p>

                <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
                  <div className="space-y-2">
                    <Label>API Endpoint URL</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extension-api`}
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" onClick={copyApiEndpoint}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Your API Token</Label>
                    <p className="text-xs text-muted-foreground">
                      Get your token from the admin or paste it here to test
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="ext_xxxxxxxxx..."
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        className="font-mono"
                      />
                      <Button variant="outline" size="icon" onClick={copyToken} disabled={!apiToken}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button onClick={testConnection} disabled={testStatus === "testing"} className="gap-2">
                    {testStatus === "testing" ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : testStatus === "success" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Connection Valid
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Step 4: Login to Turnitin */}
            <AccordionItem value="step-4" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">4</Badge>
                  <span>Login to Turnitin</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Open Turnitin in your browser and log in to your instructor account. Keep this tab open while the extension is running.
                </p>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Make sure you're logged into an account with access to submit documents to the configured slots.
                  </AlertDescription>
                </Alert>
                <Button variant="outline" asChild className="gap-2">
                  <a href="https://www.turnitin.com" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open Turnitin
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Step 5: Start Processing */}
            <AccordionItem value="step-5" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center">5</Badge>
                  <span>Start Processing</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click the extension icon to open the popup. You should see:
                </p>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Connection status: Connected
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Queue count showing pending documents
                  </li>
                  <li className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    Start/Pause button to control processing
                  </li>
                </ul>
                <p className="text-sm">
                  Click <strong>Start</strong> to begin automatic processing. The extension will:
                </p>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Pick up the oldest pending document</li>
                  <li>Upload it to an available Turnitin slot</li>
                  <li>Wait for processing to complete</li>
                  <li>Capture the similarity report</li>
                  <li>Upload it back and mark as completed</li>
                  <li>Repeat for the next document</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Troubleshooting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Extension says "Disconnected"</h4>
                <p className="text-sm text-muted-foreground">
                  Check your API token is correct and not expired. Ask admin for a new token if needed.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Documents not being picked up</h4>
                <p className="text-sm text-muted-foreground">
                  Make sure you're logged into Turnitin and the extension is running (not paused).
                </p>
              </div>
              <div>
                <h4 className="font-medium">Upload to Turnitin fails</h4>
                <p className="text-sm text-muted-foreground">
                  Check that your Turnitin slots are configured correctly and not at daily limit.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Report capture fails</h4>
                <p className="text-sm text-muted-foreground">
                  The extension needs the Turnitin report page to fully load. Try increasing the wait time in extension options.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExtensionSetup;
