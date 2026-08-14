import { v } from "convex/values";
import { authedQuery } from "./model/functions";

// Team members for owner pickers and avatars. Seeded in demo mode; in a real
// deployment these come from Convex Auth sign-ins.
export const list = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
