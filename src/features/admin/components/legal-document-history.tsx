"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Download, Trash2, Calendar, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { LegalDocumentId } from "@/constants/legal-documents";
import { deleteVersionAction } from "../actions/legal-documents";

interface DocumentVersion {
  id: string;
  version: string;
  url: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface LegalDocumentHistoryProps {
  documentId: LegalDocumentId;
  versions: DocumentVersion[];
  currentVersion: string;
  onDelete?: () => void;
}

export function LegalDocumentHistory({
  documentId,
  versions,
  currentVersion,
  onDelete,
}: LegalDocumentHistoryProps) {
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const router = useRouter();

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  const handleDelete = async (version: string, blobPathname?: string) => {
    setDeletingVersion(version);

    const formData = new FormData();
    formData.append("documentId", documentId);
    formData.append("version", version);
    if (blobPathname) {
      formData.append("blobPathname", blobPathname);
    }

    const result = await deleteVersionAction(null, formData);

    setDeletingVersion(null);

    if (result.success) {
      toast.success(`Version ${version} deleted successfully`);
      if (onDelete) {
        onDelete();
      }
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete version");
    }
  };

  const extractBlobPathname = (url: string): string | undefined => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return undefined;
    }
  };

  if (versions.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border p-4 text-center text-sm">
        No versions found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {versions.map((version) => {
        const isCurrent = version.version === currentVersion;
        const blobPathname = extractBlobPathname(version.url);

        return (
          <div
            key={`${version.id}-${version.version}`}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-4">
              <FileText className="text-muted-foreground h-5 w-5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Version {version.version}</span>
                  {isCurrent && <Badge variant="default">Current</Badge>}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Published:{" "}
                    {new Date(version.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(version.url)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              {!isCurrent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingVersion === version.version}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Version?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete version{" "}
                        {version.version}? This action cannot be undone and will
                        remove the file from storage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          handleDelete(version.version, blobPathname)
                        }
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
