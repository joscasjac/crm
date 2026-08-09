import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Demo mode: wipe and re-seed the whole workspace every ten minutes.
// FORKS: this exists because the repo powers a public demo. The handler is a
// no-op once demo mode is off (npx convex run demo:disableDemoMode), but you
// should still delete this line. See "Turning off the demo reset" in the
// README for a copy-paste agent prompt that does both.
crons.interval("demo reset", { minutes: 10 }, internal.demo.reset, {});

// Agent queue heartbeat: claim due tasks and hand them to the workpool.
crons.interval("agent tick", { minutes: 1 }, internal.agentTasks.tick, {});

export default crons;
