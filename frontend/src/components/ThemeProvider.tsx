"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes"; //reexportin next themes prov to use
import type { ThemeProviderProps } from "next-themes"; // types for theme provider props

export function ThemeProvider({ children, ...props }: ThemeProviderProps) { 
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
