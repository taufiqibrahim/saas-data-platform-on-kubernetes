import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy } from "lucide-react";

interface CopyCellProps {
  value: string | number; // the text to display and copy
}

export const CopyCell: FC<CopyCellProps> = ({ value }) => {

  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!value) return
    navigator.clipboard.writeText(String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500) // hide after 1.5s
  }

  return (
    <div className="flex items-center space-x-1 relative">
      <span className="truncate">{value}</span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="relative"
          >
            <Copy className="w-2 h-2 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy to clipboard</TooltipContent>
      </Tooltip>

      {copied && (
        <span className="px-2 py-1 rounded bg-green-600 text-white text-xs font-medium shadow-md transition-opacity animate-fade-in-out">
          Copied!
        </span>
      )}
    </div>

  );
};
