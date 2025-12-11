"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LegalDocumentHistory } from "./legal-document-history";
import type { LegalDocumentId } from "@/constants/legal-documents";
import type {
  CurrentDocumentVersion,
  DocumentVersion,
} from "@/dal/legal-document.dal";

interface DocumentVersionCardProps {
  documentId: LegalDocumentId;
  metadata: { name: string; category: string };
  currentVersion: CurrentDocumentVersion | null;
  versions: DocumentVersion[];
  isPublished: boolean;
}

export function DocumentVersionCard({
  documentId,
  metadata,
  currentVersion,
  versions,
  isPublished,
}: DocumentVersionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{metadata.name}</h3>
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              {currentVersion ? (
                <>
                  <span>v{currentVersion.version}</span>
                  <span>•</span>
                  <span>
                    {new Date(currentVersion.publishedAt).toLocaleDateString()}
                  </span>
                </>
              ) : (
                <span>No version published</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={isPublished ? "default" : "secondary"}
            className="text-xs"
          >
            {isPublished ? "Published" : "Not Published"}
          </Badge>
          {currentVersion && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.open(currentVersion.url, "_blank")}
            >
              <FileText className="mr-1.5 h-3 w-3" />
              View
            </Button>
          )}
          {versions.length > 0 && (
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                History ({versions.length})
                {isOpen ? (
                  <ChevronUp className="ml-1.5 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1.5 h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </div>
      {versions.length > 0 && (
        <CollapsibleContent className="pl-4">
          <div className="border-l-2 pl-4">
            <h4 className="mb-3 font-medium">Version History</h4>
            <LegalDocumentHistory
              documentId={documentId}
              versions={versions}
              currentVersion={currentVersion?.version || ""}
            />
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
