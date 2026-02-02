import { Button } from "@/components/ui/button"
import { useCreate, useNotify, useRecordContext } from "ra-core"
import { useState } from "react"

const ALLOWED_STATUSES = [
  'PENDING',
  'PENDING_BOOTSTRAP',
  'BOOTSTRAP_FAILED',
]

export const BootstrapClusterButton = () => {

  const [create] = useCreate();
  const notify = useNotify();
  const record = useRecordContext()

  const [command, setCommand] = useState<string | null>(null)
  const [expiredAt, setExpiredAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true);
      await create(
        `workspaces/${record!.uid}/bootstrapCluster`,
        { data: {} },
        {
          onSuccess: (data) => {
            console.log("Success", data);

            setExpiredAt(data.expiredAt)
            setCommand(`curl -fsSL https://install.<yourproduct>.com/agent.yaml?token=${data.token} | kubectl apply -f -`)
          }
        }
      )
    } catch (e) {
      console.error(e)
      notify('Failed to generate bootstrap command', { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (command) {
      try {
        await navigator.clipboard.writeText(command)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (e) {
        notify('Failed to copy to clipboard', { type: 'error' })
      }
    }
  }

  if (!record || !ALLOWED_STATUSES.includes(record.status)) {
    return null
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? 'Generating…' : 'Bootstrap your cluster'}
      </Button>

      {command && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Run this command in your Kubernetes cluster.
            Token will expire at {expiredAt}.
          </p>

          <div className="relative">
            <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
              <code>{command}</code>
            </pre>

            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
