import { exposeDeploymentQuery } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

// Lets the client subscribe to deploys so an update banner can offer a
// refresh when a new build ships.
export const { getCurrentDeployment } = exposeDeploymentQuery(
  components.staticHosting,
);
