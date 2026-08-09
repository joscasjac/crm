import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Demo mode: wipe and re-seed the whole workspace every ten minutes.
crons.interval("demo reset", { minutes: 10 }, internal.demo.reset, {});

// Agent queue heartbeat: claim due tasks and hand them to the workpool.
crons.interval("agent tick", { minutes: 1 }, internal.agentTasks.tick, {});

export default crons;
