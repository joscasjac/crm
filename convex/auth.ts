import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Email is required");
  }
  const email = value.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Enter a valid email address");
  }
  return email;
}

function displayName(params: Record<string, unknown>, email: string): string {
  const name = params.name;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }
  return email.split("@")[0] || email;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = normalizeEmail(params.email);
        return {
          name: displayName(params, email),
          email,
          role: "owner",
        };
      },
    }),
  ],
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get("users", userId);
      const workspace = await ctx.db.query("workspace").first();
      const email = user?.email?.trim().toLowerCase();
      const allowed = new Set(
        (workspace?.allowedSignIn ?? []).map((value: string) =>
          value.trim().toLowerCase(),
        ),
      );

      if (!email || !allowed.has(email)) {
        throw new Error("This email is not allowed to sign in.");
      }
    },
  },
});
