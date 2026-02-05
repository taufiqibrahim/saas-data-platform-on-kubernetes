import { useState } from "react";
import { useRecordContext } from "ra-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Terminal, Clock } from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL;

// Platform providers that support agent bootstrap
const KUBERNETES_PROVIDERS = ["KUBERNETES", "AWS_EKS", "ALICLOUD_ACK"];

export const AgentBootstrapCommand = () => {
  const record = useRecordContext();
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const platformProvider = record.account?.platformProvider?.name;
  const clusterAgent = record.clusterAgent;
  const bootstrapToken = clusterAgent?.bootstrapToken;

  // Only show for Kubernetes-based platforms
  if (!platformProvider || !KUBERNETES_PROVIDERS.includes(platformProvider)) {
    return null;
  }

  // Don't show if no cluster agent or no bootstrap token
  if (!clusterAgent || !bootstrapToken) {
    return null;
  }

  const isAgentActive = clusterAgent.status === "Active";
  const isTokenExpired = new Date(bootstrapToken.expiredAt) < new Date();

  // Build the bootstrap command
  const command = `curl -fsSL ${apiUrl}/agent/bootstrap.yaml?token=${bootstrapToken.token} | kubectl apply -f -`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard", e);
    }
  };

  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // If agent is already active, show status instead
  if (isAgentActive) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Agent Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">Active</Badge>
            {clusterAgent.lastPingAt && (
              <span className="text-xs text-muted-foreground">
                Last seen: {formatExpiry(clusterAgent.lastPingAt)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show bootstrap command for pending registration
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Bootstrap Agent
        </CardTitle>
        <CardDescription>
          Run this command in your Kubernetes cluster to register the agent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={isTokenExpired ? "destructive" : "secondary"}>
            {clusterAgent.status}
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {isTokenExpired
                ? "Token expired"
                : `Expires: ${formatExpiry(bootstrapToken.expiredAt)}`}
            </span>
          </div>
        </div>

        {!isTokenExpired && (
          <div className="relative">
            <pre className="bg-muted p-3 pr-16 rounded-md text-xs overflow-x-auto font-mono">
              <code>{command}</code>
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}

        {isTokenExpired && (
          <p className="text-sm text-destructive">
            The bootstrap token has expired. Please generate a new one.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
