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
  title: "ResCheck — does your resume pass?",
  description:
    "Check a resume against a job description: the score an ATS would give it, the lines that hurt it, and the skills it's missing. Bring your own Groq key; nothing is stored.",
  openGraph: {
    title: "ResCheck",
    description: "Check a resume against a job description before you apply.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResCheck",
    description: "Check a resume against a job description before you apply.",
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
