import { HistoryList } from "@/components/history/HistoryList";

export const metadata = {
  title: "History — ResCheck",
};

export default function HistoryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">
          Kept in this browser only — the last 20 runs.
        </p>
      </div>
      <HistoryList />
    </div>
  );
}
