const STEPS = [
  {
    title: "Paste the job description",
    description: "The full posting — requirements, responsibilities, qualifications.",
  },
  {
    title: "Upload your resume PDF",
    description: "Parsed in-memory on the server; nothing is stored anywhere.",
  },
  {
    title: "Get scores and fixes",
    description: "One score, the reasons behind it, and a rewrite for every flagged line.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 border-t border-border/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-center mb-10">
          How it works
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
          {STEPS.map((step, i) => (
            <li key={i} className="text-center sm:text-left">
              <span className="text-sm font-medium text-primary tabular-nums">
                0{i + 1}
              </span>
              <h3 className="font-medium mt-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
