"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ApiKeyInputProps {
  value: string;
  onChange: (key: string) => void;
}

export function ApiKeyInput({ value, onChange }: ApiKeyInputProps) {
  const [show, setShow] = useState(false);

  const isValidFormat = value.startsWith("gsk_") && value.length > 20;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        Groq API Key
        <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="gsk_..."
          className={cn(
            "pr-20 font-mono text-sm",
            isValidFormat && "border-green-500 focus-visible:ring-green-500"
          )}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isValidFormat && (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Lock className="w-3 h-3" />
        Stored only in your browser. Never sent to our servers.{" "}
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline"
        >
          Get a free key
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </p>
    </div>
  );
}
