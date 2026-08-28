import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

const sans = Inter({
  variable: "--font-sans-loaded",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResCheck — does your résumé survive screening?",
  description:
    "Check a résumé against a job posting: whether it parses, whether it meets the stated requirements, and whether a recruiter's search would surface it. Two free checks, no account, nothing kept.",
  openGraph: {
    title: "ResCheck",
    description:
      "Find out what screening actually does to your résumé. No score, no guessing — only what can be computed.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResCheck",
    description:
      "Find out what screening actually does to your résumé. No score, no guessing — only what can be computed.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <main className="flex-1">{children}</main>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
