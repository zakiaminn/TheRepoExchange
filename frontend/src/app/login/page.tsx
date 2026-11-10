import type { Metadata } from "next";
import LoginView, { type Mode } from "./LoginView";
import { AUTH } from "@/lib/copy";

type Search = { mode?: string; error?: string; next?: string };

// the tab title follows the form that's open. the page is kept out of search, since
// the landing page is what a search for the site should find
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { mode } = await searchParams;
  const title =
    mode === "signup" ? AUTH.applyTitle : mode === "forgot" ? AUTH.forgotTitle : AUTH.returnTitle;
  return { title, robots: { index: false, follow: true } };
}

// only same-site paths, so ?next= can't send anyone off the site after they sign in
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

// reads the mode off the url on the server so the right form is in the first paint:
// /login?mode=signup opens an account, ?mode=forgot asks for a reset link. ?error= is
// set by /auth/callback when a link fails, and ?next= is where sign-in goes afterwards
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { mode, error, next } = await searchParams;
  const initial: Mode = mode === "signup" || mode === "forgot" ? mode : "signin";
  return <LoginView initialMode={initial} error={error ?? null} next={safeNext(next)} />;
}
