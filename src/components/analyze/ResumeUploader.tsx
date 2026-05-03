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
          onFileRejected("File too large. Maximum size is 5MB.");
        } else if (code === "file-invalid-type") {
          onFileRejected("Only PDF files are supported.");
        } else {
          onFileRejected("Could not accept this file.");
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
      <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/50 bg-green-500/5">
        <FileText className="w-8 h-8 text-green-500 shrink-0" />
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
        "relative flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        isDragActive
          ? "border-indigo-500 bg-indigo-500/5"
          : "border-border hover:border-indigo-400 hover:bg-muted/30"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
        {isDragActive ? (
          <AlertCircle className="w-6 h-6 text-indigo-500" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {isDragActive ? "Drop your PDF here" : "Upload Resume PDF"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Drag & drop or click to browse · PDF only · Max 5MB
        </p>
      </div>
    </div>
  );
}
