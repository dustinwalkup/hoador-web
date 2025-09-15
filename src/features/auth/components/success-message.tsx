import { CheckCircle } from "lucide-react";

interface SuccessMessageProps {
  title: string;
  description: string;
}

export function SuccessMessage({ title, description }: SuccessMessageProps) {
  return (
    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-start">
        <CheckCircle className="text-primary mt-0.5 mr-3 h-5 w-5 flex-shrink-0" />
        <div>
          <h3 className="text-primary text-sm font-medium">{title}</h3>
          <p className="text-primary mt-1 text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}
