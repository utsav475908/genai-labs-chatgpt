import { useEffect, useState } from "react";

type Health = "checking" | "up" | "reachable" | "down";

const POLL_MS = 30_000;

const LABELS: Record<Health, string> = {
  checking: "API checking",
  up: "API up",
  reachable: "API reachable",
  down: "API down",
};

/**
 * Pings the lab's backend now and every 30 seconds while the lab is open.
 * Deployed, the check is same-origin (/api/<id>) so the status is readable: "up" or "down".
 * Locally, backends on other ports may only allow their own frontend via CORS, so the check
 * uses "no-cors": the status is hidden and the best we can say is that the server answered.
 */
export function HealthBadge({ url }: { url: string }) {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let controller: AbortController | null = null;

    const check = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      fetch(url, { mode: "no-cors", signal: current.signal, cache: "no-store" })
        .then((r) => setHealth(r.type === "opaque" ? "reachable" : r.ok ? "up" : "down"))
        .catch(() => !current.signal.aborted && setHealth("down"));
    };

    setHealth("checking");
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      window.clearInterval(timer);
      controller?.abort();
    };
  }, [url]);

  return <span className={`badge badge-${health}`}>{LABELS[health]}</span>;
}
