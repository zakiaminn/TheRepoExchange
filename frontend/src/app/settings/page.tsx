"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Toast, ToastMessage } from "@/components/Toast";

// lets the user update their first/last name. email is shown but locked since it's tied
// to their supabase auth identity, changing that is a whole different flow we don't support
export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [message, setMessage] = useState<ToastMessage>(null);

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) { // not logged in, bounce them
        window.location.href = "/login";
      } else {
        // pre-fill the form with what we already know about them
        setEmail(user.email || "");
        setFirstName(user.user_metadata?.first_name || "");
        setLastName(user.user_metadata?.last_name || "");
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, [supabase.auth]);

  // just writes the new name straight into supabase's user_metadata, nothing fancy
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      });

      if (error) {
        setMessage({ text: error.message, type: "error" });
      } else {
        setMessage({ text: "Profile updated successfully.", type: "success" });
      }
    } catch (err) {
      setMessage({ text: "An unexpected error occurred.", type: "error" });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 4000); // clear the message after a bit so it doesn't just sit there
    }
  };

  if (isInitializing) { // show a loading state so the page doesn't flash
    return (
      <div className="min-h-screen bg-page flex items-center justify-center text-sm text-ink-muted">
        SECURING CONNECTION...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-ink font-sans relative selection:bg-accent selection:text-accent-foreground transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-xl mx-auto px-6 py-12">
          <div className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tighter mb-1">Account Settings</h1>
            </div>

            <div className="text-right">
              <Link href="/" className="text-[10px] uppercase tracking-[0.15em] text-ink-muted hover:text-accent transition-colors">
                Back to Terminal
              </Link>
            </div>
          </div>

          <div className="bg-card border-2 border-edge p-8 shadow-brutal">
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-ink-muted mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  disabled // can't change email, it's tied to their auth
                  className="w-full h-10 px-3 bg-card-alt border-2 border-edge text-ink-muted text-sm focus:outline-none cursor-not-allowed transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-ink-muted mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-card border-2 border-edge text-ink text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    placeholder="First Name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-ink-muted mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-card border-2 border-edge text-ink text-sm focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full h-10 mt-4 text-xs font-bold tracking-wide uppercase border-2 transition-all duration-150 flex items-center justify-center ${
                  isLoading
                    ? 'bg-card-alt text-ink-muted cursor-not-allowed border-edge'
                    : 'bg-accent text-accent-foreground border-edge press-brutal shadow-brutal-sm'
                }`}
              >
                {isLoading ? 'Saving...' : 'Update Profile'}
              </button>
            </form>
          </div>
        </main>
      </div>

      <Toast message={message} />
    </div>
  );
}
