"use client";

import { useState, useCallback } from "react";
import type { AnalysisResult } from "@/types/analysis";

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(
    async (element: HTMLElement, result: AnalysisResult) => {
      setIsExporting(true);
      try {
        const { exportResultsPdf } = await import("@/lib/export-pdf");
        await exportResultsPdf(element, result);
      } catch (err) {
        console.error("Export failed:", err);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return { exportPdf, isExporting };
}
