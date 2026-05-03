"use client";

import { Textarea } from "@/components/ui/textarea";
import { Briefcase } from "lucide-react";

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function JobDescriptionInput({ value, onChange }: JobDescriptionInputProps) {
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
        Job Description
        <span className="text-red-500">*</span>
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full job description here — include requirements, responsibilities, and qualifications for the best analysis..."
        className="min-h-[180px] resize-y text-sm"
      />
      <p className="text-xs text-muted-foreground text-right">
        {wordCount} words · {charCount} chars
        {wordCount < 50 && wordCount > 0 && (
          <span className="text-amber-500 ml-2">
            — more detail = better analysis
          </span>
        )}
      </p>
    </div>
  );
}
