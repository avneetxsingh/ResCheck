const STEPS = [
  {
    number: "01",
    title: "Enter Your Groq API Key",
    description: "Get a free key from console.groq.com/keys. It's stored only in your browser and used exclusively to call Groq's AI.",
  },
  {
    number: "02",
    title: "Upload Resume & Job Description",
    description: "Drag and drop your PDF resume and paste the full job description. The more detail, the better the analysis.",
  },
  {
    number: "03",
    title: "Get Your Instant Report",
    description: "In seconds, receive your ATS score, skill gaps, and line-by-line fixes — ready to act on immediately.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-muted/30 rounded-3xl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">How it works</h2>
          <p className="text-muted-foreground mt-3">Three steps to a stronger resume</p>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden sm:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-border" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-4">
                <div className="relative z-10 w-16 h-16 rounded-full bg-background border-2 border-indigo-500 flex items-center justify-center">
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {step.number}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
