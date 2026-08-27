import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Agent queue heartbeat: claim due tasks and hand them to the workpool.
crons.interval("agent tick", { minutes: 1 }, internal.agentTasks.tick, {});

export default crons;
