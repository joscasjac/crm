import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

// Slim status strip above the app shell. Shows demo mode and the countdown
// to the next cron reset; resets happen on their own, no manual trigger.
export function DemoBanner() {
  const info = useQuery(api.demo.info);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!info || !info.demoMode) return null;

  const nextResetAt = info.lastResetAt + info.resetIntervalMs;
  const remainingMs = Math.max(0, nextResetAt - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 border-b border-edge bg-panel px-4 py-1.5 text-xs text-neutral-400">
      <span>
        Demo mode. Content resets every 10 minutes. Next reset in {minutes}:
        {seconds}. Auth and email are not configured on this demo.
      </span>
    </div>
  );
}
