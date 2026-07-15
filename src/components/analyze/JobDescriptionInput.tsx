"use client";

import { Textarea } from "@/components/ui/textarea";

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function JobDescriptionInput({ value, onChange }: JobDescriptionInputProps) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Job description</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full posting — requirements, responsibilities, all of it."
        className="min-h-[224px] resize-y text-sm"
      />
      <p className="text-xs text-muted-foreground text-right">
        {wordCount} words
        {wordCount > 0 && wordCount < 30 && (
          <span className="text-amber-600 dark:text-amber-400 ml-2">
            — short posting: keyword matching will be thin, the writing audit still runs
          </span>
        )}
        {wordCount >= 30 && wordCount < 80 && (
          <span className="text-amber-600 dark:text-amber-400 ml-2">
            — more detail here means better skill matching
          </span>
        )}
      </p>
    </div>
  );
}
