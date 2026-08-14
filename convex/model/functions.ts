import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { requireReadAccess, requireWriteAccess } from "./access";

// Convex's alternative to row level security: every write goes through this
// wrapper, which runs the access check before the handler. When Convex Auth
// is wired, requireWriteAccess is the only place that needs to change.
export const writeMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    await requireWriteAccess(ctx);
    return {};
  }),
);

// The read counterpart. Every query that returns table data uses this instead
// of the raw `query` from _generated/server, so reads are gated by the same
// demo-mode-or-authenticated rule as writes. Only demo:info and the
// static-hosting deploy query stay on the raw builder, on purpose.
export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    await requireReadAccess(ctx);
    return {};
  }),
);
