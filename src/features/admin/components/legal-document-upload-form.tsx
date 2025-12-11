"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LEGAL_DOCUMENT_METADATA } from "@/constants/legal-documents";
import { validatePDFFile } from "@/lib/utils/document-validation";
import { uploadDocumentAction } from "../actions/legal-documents";

interface LegalDocumentUploadFormProps {
  onSuccess?: () => void;
}

export function LegalDocumentUploadForm({
  onSuccess,
}: LegalDocumentUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isTransitionPending, startTransition] = useTransition();
  const router = useRouter();
  const previousStateRef = useRef<typeof state>(null);

  const [state, formAction, isPending] = useActionState(
    uploadDocumentAction,
    null,
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file
    const validation = validatePDFFile(file);
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFileError(null);

    const formData = new FormData(e.currentTarget);

    if (!selectedFile) {
      setFileError("Please select a PDF file");
      return;
    }

    formData.append("file", selectedFile);

    startTransition(() => {
      formAction(formData);
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileError(null);
    const form = document.querySelector("form");
    if (form) {
      form.reset();
    }
  };

  // Handle success/error states with useEffect to avoid infinite loops
  useEffect(() => {
    // Prevent duplicate executions
    if (previousStateRef.current === state) {
      return;
    }
    previousStateRef.current = state;

    if (state?.success) {
      toast.success(`Document version ${state.version} uploaded successfully`);

      // Wrap state updates in startTransition to avoid cascading renders
      startTransition(() => {
        setSelectedFile(null);
        // Reset form
        const form = document.querySelector("form");
        if (form) {
          form.reset();
        }
      });

      if (onSuccess) {
        onSuccess();
      }
      // Refresh page to show new version
      router.refresh();
    }

    if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess, router, startTransition]);

  const isLoading = isPending || isTransitionPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <div className="space-y-2">
          <Label htmlFor="documentId">Document Type</Label>
          <Select name="documentId" required disabled={isLoading}>
            <SelectTrigger className="mb-0 w-fit">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEGAL_DOCUMENT_METADATA).map(([id, metadata]) => (
                <SelectItem key={id} value={id}>
                  {metadata.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            name="version"
            placeholder="e.g., 1.0, 2.1, 1.2.3"
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">PDF File</Label>
          <div className="flex items-center gap-4">
            <Input
              id="file"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={isLoading}
              className="cursor-pointer"
            />
          </div>
          {fileError && <p className="text-sm text-red-600">{fileError}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading || !selectedFile}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isLoading || (!selectedFile && !state)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>
    </form>
  );
}
