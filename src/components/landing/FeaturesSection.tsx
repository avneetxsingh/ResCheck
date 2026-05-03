import { Target, Zap, FileSearch, BarChart3, Download, Shield } from "lucide-react";

const FEATURES = [
  {
    icon: BarChart3,
    title: "ATS Scorecard",
    description: "Get a composite score across 6 dimensions: ATS compatibility, skills match, grammar, formatting, impact, and keyword density.",
  },
  {
    icon: Target,
    title: "Skills Gap Analysis",
    description: "See exactly which must-have and nice-to-have skills are missing from your resume vs. the job description.",
  },
  {
    icon: FileSearch,
    title: "Line-by-Line Fixes",
    description: "Every error includes the original line, a fixed version, and a word-level diff so you know exactly what changed.",
  },
  {
    icon: Zap,
    title: "10-Second Analysis",
    description: "Groq's ultra-fast inference means you get a full resume audit in seconds, not minutes.",
  },
  {
    icon: Download,
    title: "Export Report",
    description: "Download your full analysis as a PDF to share with a career coach or keep for reference.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your Groq API key is stored only in your browser. Your resume is never saved to any server.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Everything you need to beat the ATS</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            ResCheck gives you the same insights that professional resume writers charge hundreds of dollars for.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
