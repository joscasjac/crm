import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { mutation } from "../_generated/server";
import { requireWriteAccess } from "./access";

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
