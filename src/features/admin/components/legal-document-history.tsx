"use client";

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
import { useDeleteDocumentVersion } from "../hooks/use-admin-mutations";
import { toast } from "sonner";

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
  const deleteMutation = useDeleteDocumentVersion();

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  const handleDelete = async (version: string, blobPathname?: string) => {
    try {
      await deleteMutation.mutateAsync(
        {
          documentId,
          version,
          blobPathname,
        },
        {
          onSuccess: () => {
            toast.success(`Version ${version} deleted successfully`);
            if (onDelete) {
              onDelete();
            }
          },
        },
      );
    } catch (error) {
      // Error is already handled by the mutation hook
      console.error("Failed to delete version:", error);
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
                      disabled={deleteMutation.isPending}
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
