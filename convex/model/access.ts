import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// The single place where write access is decided. In demo mode every visitor
// may read and write, and a cron resets the content every ten minutes. When
// Convex Auth is wired (see docs/deploy.md), this is the function that
// switches to ctx.auth.getUserIdentity() plus the workspace allow list.
export async function getWorkspace(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"workspace">> {
  const workspace = await ctx.db.query("workspace").first();
  if (!workspace) {
    throw new Error("Workspace not seeded yet. Run demo:seedPublic.");
  }
  return workspace;
}

export async function requireWriteAccess(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"workspace">> {
  const workspace = await getWorkspace(ctx);
  if (workspace.demoMode) {
    return workspace;
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return workspace;
}
