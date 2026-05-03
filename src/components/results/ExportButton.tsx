"use client";

import { useRef } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExport } from "@/hooks/useExport";
import type { AnalysisResult } from "@/types/analysis";

interface ExportButtonProps {
  result: AnalysisResult;
  targetRef: React.RefObject<HTMLDivElement | null>;
}

export function ExportButton({ result, targetRef }: ExportButtonProps) {
  const { exportPdf, isExporting } = useExport();

  const handleExport = async () => {
    if (!targetRef.current) return;
    await exportPdf(targetRef.current, result);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="w-4 h-4" />
      {isExporting ? "Exporting..." : "Export PDF"}
    </Button>
  );
}
