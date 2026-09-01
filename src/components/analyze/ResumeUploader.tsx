"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-limit";

interface ResumeUploaderProps {
  file: File | null;
  onFileAccepted: (file: File) => void;
  onFileRejected: (reason: string) => void;
  onClear: () => void;
}

export function ResumeUploader({
  file,
  onFileAccepted,
  onFileRejected,
  onClear,
}: ResumeUploaderProps) {
  const onDrop = useCallback(
    (accepted: File[], rejected: import("react-dropzone").FileRejection[]) => {
      if (accepted.length > 0) {
        onFileAccepted(accepted[0]);
      } else if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        if (code === "file-too-large") {
          onFileRejected(`That file is over ${MAX_UPLOAD_MB} MB.`);
        } else if (code === "file-invalid-type") {
          onFileRejected("PDFs only — export your resume as a PDF first.");
        } else {
          onFileRejected("Couldn't read that file.");
        }
      }
    },
    [onFileAccepted, onFileRejected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    // Rejecting here means the user gets a sentence instead of a platform 413
    // after a pointless upload. /api/parse-pdf enforces the same constant.
    maxSize: MAX_UPLOAD_BYTES,
    maxFiles: 1,
  });

  if (file) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
        <FileText className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(0)} KB · PDF
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onClear}
          aria-label="Remove file"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative flex min-h-[224px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8",
        "transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-settle)]",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50 hover:bg-muted/40"
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full bg-muted",
          "transition-transform duration-[var(--dur-fast)] ease-[var(--ease-settle)]",
          isDragActive ? "scale-110" : "group-hover:scale-105"
        )}
      >
        <Upload
          className={cn(
            "h-6 w-6 transition-colors duration-[var(--dur-fast)]",
            isDragActive ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {isDragActive ? "Drop it" : "Drop your resume here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to browse · PDF, up to {MAX_UPLOAD_MB} MB
        </p>
      </div>
    </div>
  );
}
