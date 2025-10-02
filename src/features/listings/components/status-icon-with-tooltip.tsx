import { CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatusIconWithTooltipProps {
  status: string;
}

export function StatusIconWithTooltip({ status }: StatusIconWithTooltipProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rented":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "maintenance":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "inactive":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="cursor-help"
            aria-label="View listing status"
          >
            {getStatusIcon(status)}
          </button>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-900 text-white">
          <p className="capitalize">Status: {status}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
