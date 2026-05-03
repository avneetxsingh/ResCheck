import { HistoryList } from "@/components/history/HistoryList";

export const metadata = {
  title: "Analysis History — ResCheck",
};

export default function HistoryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analysis History</h1>
        <p className="text-muted-foreground mt-1">
          Your past analyses are saved locally in your browser.
        </p>
      </div>
      <HistoryList />
    </div>
  );
}
