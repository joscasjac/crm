import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseCtx = QueryCtx | MutationCtx;
type AuthCtx = Pick<QueryCtx, "auth"> | Pick<MutationCtx, "auth"> | Pick<ActionCtx, "auth">;

export type AccessActor =
  | { kind: "demo"; label: "Demo visitor" }
  | {
      kind: "user";
      identity: UserIdentity;
      email?: string;
      name?: string;
    };

export type AccessContext = {
  workspace: Doc<"workspace"> | null;
  actor: AccessActor;
  demoMode: boolean;
  canRead: boolean;
  canWrite: boolean;
};

export type WorkspaceMember = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: Doc<"users">["role"];
  avatarUrl?: string;
};

// The single place where write access is decided. In demo mode every visitor
// may read and write, and a cron resets the content every ten minutes. When
// Convex Auth is wired (see "Not built yet" in AGENTS.md), this is the
// function that switches to ctx.auth.getUserIdentity() plus the workspace
// allow list.
export async function getWorkspace(
  ctx: DatabaseCtx,
): Promise<Doc<"workspace">> {
  const workspace = await ctx.db.query("workspace").first();
  if (!workspace) {
    throw new Error("Workspace not seeded yet. Run demo:seedPublic.");
  }
  return workspace;
}

export async function workspaceOrNull(
  ctx: DatabaseCtx,
): Promise<Doc<"workspace"> | null> {
  return await ctx.db.query("workspace").first();
}

export async function requireAuthenticatedIdentity(
  ctx: AuthCtx,
  message = "Not authenticated",
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error(message);
  }
  return identity;
}

function actorFromIdentity(identity: UserIdentity): AccessActor {
  return {
    kind: "user",
    identity,
    email: identity.email,
    name: identity.name,
  };
}

export function isEmailAllowedForSignIn(
  workspace: Doc<"workspace"> | null,
  email: string | undefined,
): boolean {
  if (!workspace || !email) return false;
  const allowed = new Set(
    workspace.allowedSignIn.map((value) => value.trim().toLowerCase()),
  );
  return allowed.has(email.trim().toLowerCase());
}

export function emailMatchesAllowedDomain(
  email: string,
  domain: string | null | undefined,
): boolean {
  const normalizedDomain = domain?.trim().toLowerCase().replace(/^@/, "");
  if (!normalizedDomain) return false;
  return email.trim().toLowerCase().endsWith(`@${normalizedDomain}`);
}

export async function workspaceMemberByEmail(
  ctx: DatabaseCtx,
  email: string | undefined,
): Promise<WorkspaceMember | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .unique();
  return user
    ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }
    : null;
}

export async function workspaceMemberForIdentity(
  ctx: DatabaseCtx,
): Promise<WorkspaceMember | null> {
  const identity = await ctx.auth.getUserIdentity();
  return await workspaceMemberByEmail(ctx, identity?.email);
}

export async function currentUserId(
  ctx: DatabaseCtx,
): Promise<Id<"users"> | undefined> {
  return (await workspaceMemberForIdentity(ctx))?._id;
}

export async function workspaceActorByEmail(
  ctx: DatabaseCtx,
  args: {
    email: string;
    fallbackName: string;
    allowedEmailDomain?: string | null;
  },
): Promise<{ name: string; email: string; userId?: Id<"users"> } | null> {
  const email = args.email.trim().toLowerCase();
  const member = await workspaceMemberByEmail(ctx, email);
  if (member) return { name: member.name, email, userId: member._id };
  if (emailMatchesAllowedDomain(email, args.allowedEmailDomain)) {
    return { name: args.fallbackName, email };
  }
  return null;
}

export async function requireAccessContext(
  ctx: DatabaseCtx,
  operation: "read" | "write",
): Promise<AccessContext> {
  const workspace = await workspaceOrNull(ctx);
  if (!workspace) {
    if (operation === "read") {
      return {
        workspace: null,
        actor: { kind: "demo", label: "Demo visitor" },
        demoMode: true,
        canRead: true,
        canWrite: false,
      };
    }
    throw new Error("Workspace not seeded yet. Run demo:seedPublic.");
  }

  if (workspace.demoMode) {
    return {
      workspace,
      actor: { kind: "demo", label: "Demo visitor" },
      demoMode: true,
      canRead: true,
      canWrite: true,
    };
  }

  const identity = await requireAuthenticatedIdentity(ctx);
  return {
    workspace,
    actor: actorFromIdentity(identity),
    demoMode: false,
    canRead: true,
    canWrite: true,
  };
}

export async function requireWriteAccess(
  ctx: DatabaseCtx,
): Promise<Doc<"workspace">> {
  const access = await requireAccessContext(ctx, "write");
  if (!access.workspace) {
    throw new Error("Workspace not seeded yet. Run demo:seedPublic.");
  }
  return access.workspace;
}

// The read counterpart to requireWriteAccess, and the reason nothing but
// demo:info and the static-hosting deploy query is exposed unauthenticated.
// In demo mode every visitor may read, matching the public demo. Turning demo
// mode off makes every gated query require a signed-in session.
//
// Tolerant of the brief unseeded window: before seedPublic runs there is no
// workspace row, and the app boots by calling the still-public demo:info and
// then seeding, so an unseeded read is treated as open rather than throwing.
export async function requireReadAccess(
  ctx: DatabaseCtx,
): Promise<Doc<"workspace"> | null> {
  return (await requireAccessContext(ctx, "read")).workspace;
}

export async function requireActionAccess(
  ctx: ActionCtx,
  snapshot: { demoMode: boolean },
  options: {
    allowDemo: boolean;
    demoMessage?: string;
    unauthenticatedMessage?: string;
  },
): Promise<AccessActor> {
  if (snapshot.demoMode) {
    if (options.allowDemo) return { kind: "demo", label: "Demo visitor" };
    throw new Error(options.demoMessage ?? "Demo mode does not allow this action.");
  }
  return actorFromIdentity(
    await requireAuthenticatedIdentity(ctx, options.unauthenticatedMessage),
  );
}
