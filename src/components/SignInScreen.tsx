import { useAuthActions } from "@convex-dev/auth/react";
import { FormEvent, useState } from "react";

type AuthFlow = "signIn" | "signUp";

export function SignInScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase text-accent">
            CRM on Convex
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            Sign in to your workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Use the email allowlisted for this install. New workspaces can
            create the first password account from here.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-md border border-edge bg-panel p-1">
          <button
            type="button"
            onClick={() => setFlow("signIn")}
            className={`rounded px-3 py-2 text-sm transition-colors ${
              flow === "signIn"
                ? "bg-raised text-white"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setFlow("signUp")}
            className={`rounded px-3 py-2 text-sm transition-colors ${
              flow === "signUp"
                ? "bg-raised text-white"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {flow === "signUp" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-400">
                Name
              </span>
              <input
                name="name"
                autoComplete="name"
                className="w-full rounded-md border border-edge bg-panel px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
                placeholder="Your name"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-400">
              Email
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-edge bg-panel px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-400">
              Password
            </span>
            <input
              name="password"
              type="password"
              autoComplete={
                flow === "signUp" ? "new-password" : "current-password"
              }
              required
              minLength={8}
              className="w-full rounded-md border border-edge bg-panel px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
              placeholder="At least 8 characters"
            />
          </label>
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Working..."
              : flow === "signUp"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
