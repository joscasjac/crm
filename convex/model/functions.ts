import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { requireAccessContext } from "./access";

// Convex's alternative to row level security: every write goes through this
// wrapper, which runs the access check before the handler and gives callers
// the resulting workspace and actor context.
export const writeMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const access = await requireAccessContext(ctx, "write");
    if (!access.workspace) {
      throw new Error("Workspace not seeded yet. Run demo:seedPublic.");
    }
    return { access, workspace: access.workspace };
  }),
);

// The read counterpart. Every query that returns table data uses this instead
// of the raw `query` from _generated/server, so reads are gated by the same
// demo-mode-or-authenticated rule as writes. Only demo:info and the
// static-hosting deploy query stay on the raw builder, on purpose.
export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const access = await requireAccessContext(ctx, "read");
    return { access, workspace: access.workspace };
  }),
);
