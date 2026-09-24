"use client";

import { ViewTransition, type ReactNode } from "react";

/* the listing's name, carried across a navigation. the same name on a table
   row and on the listing page's title makes the browser treat them as one
   object, so the name you clicked travels up into the heading instead of the
   page cutting from one to the other.

   a name can only be on the page once, so callers pass `morph={false}` for
   any repeat of a listing (the same repo can sit in two categories). */
export function ListingMorph({
  ticker,
  morph = true,
  children,
}: {
  ticker: string;
  morph?: boolean;
  children: ReactNode;
}) {
  if (!morph) return <>{children}</>;
  return (
    <ViewTransition name={`listing-${ticker.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`} share="listing-morph" default="none">
      {children}
    </ViewTransition>
  );
}
