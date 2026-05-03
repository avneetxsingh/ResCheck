import { SettingsPanel } from "@/components/settings/SettingsPanel";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your API key, model, and analysis prompt.
        </p>
      </div>
      <SettingsPanel />
    </div>
  );
}
