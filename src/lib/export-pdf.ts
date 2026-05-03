import type { AnalysisResult } from "@/types/analysis";

export async function exportResultsPdf(
  element: HTMLElement,
  result: AnalysisResult
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Header
  pdf.setFillColor(99, 102, 241); // indigo-500
  pdf.rect(0, 0, pageWidth, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("ResCheck — Resume Analysis Report", 10, 12);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const date = new Date(result.metadata.analyzed_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
  pdf.text(`Generated: ${date}  |  Overall Score: ${result.scorecard.overall_ats_score.score}/100`, pageWidth - 10, 12, { align: "right" });

  // Image content
  const contentY = 22;
  const contentHeight = pageHeight - contentY - 10;
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= contentHeight) {
    pdf.addImage(imgData, "PNG", 10, contentY, imgWidth, imgHeight);
  } else {
    // Multi-page
    let yOffset = 0;
    const scaledHeight = imgHeight;
    while (yOffset < scaledHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 10, contentY - yOffset, imgWidth, scaledHeight);
      yOffset += contentHeight;
    }
  }

  const fileName = `rescheck-report-${new Date().toISOString().split("T")[0]}.pdf`;
  pdf.save(fileName);
}
