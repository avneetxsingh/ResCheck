"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Follow the operating system on a first visit rather than imposing a
      // look. next-themes persists an explicit choice under the "theme" key,
      // so the moment someone picks Light or Dark it becomes their default on
      // every later visit and overrides this.
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
