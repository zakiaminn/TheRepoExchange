import LoginView, { type Mode } from "./LoginView";

// reads the mode off the url on the server so the right form is in the first paint:
// /login?mode=signup opens an account, ?mode=forgot asks for a reset link. ?error= is
// set by /auth/callback when a link fails
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  const initial: Mode = mode === "signup" || mode === "forgot" ? mode : "signin";
  return <LoginView initialMode={initial} error={error ?? null} />;
}
