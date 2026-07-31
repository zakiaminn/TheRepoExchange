"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes"; // just reexporting next-themes' provider so we can import it from our own components folder
import type { ThemeProviderProps } from "next-themes"; // types for the props so ts doesn't yell at us

// thin wrapper around next-themes, nothing fancy happening here. exists mainly so
// layout.tsx can import from "@/components/ThemeProvider" like everything else instead
// of reaching into next-themes directly
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
