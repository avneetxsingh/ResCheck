"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
          onFileRejected("That file is over 5 MB.");
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
    maxSize: 5 * 1024 * 1024,
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
        "relative flex flex-col items-center justify-center gap-3 p-8 min-h-[224px] rounded-lg border border-dashed cursor-pointer transition-colors",
        isDragActive
          ? "border-primary"
          : "border-border hover:border-muted-foreground/40"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
        {isDragActive ? (
          <AlertCircle className="w-6 h-6 text-primary" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {isDragActive ? "Drop it" : "Drop your resume here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to browse · PDF, up to 5 MB
        </p>
      </div>
    </div>
  );
}
