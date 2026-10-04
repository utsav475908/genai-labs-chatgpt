import { useEffect, useState } from "react";

type Health = "checking" | "up" | "down";

/**
 * Pings the lab's backend. "no-cors" lets us reach cross-origin backends whose CORS list only
 * allows their own frontend; such an opaque response proves the server answered. Same-origin
 * checks (deployed, via /api/<id>) also see the status, so a proxy 502 shows as "down".
 */
export function HealthBadge({ url }: { url: string }) {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    const controller = new AbortController();
    setHealth("checking");
    fetch(url, { mode: "no-cors", signal: controller.signal, cache: "no-store" })
      .then((r) => setHealth(r.type === "opaque" || r.ok ? "up" : "down"))
      .catch(() => !controller.signal.aborted && setHealth("down"));
    return () => controller.abort();
  }, [url]);

  return <span className={`badge badge-${health}`}>API {health}</span>;
}
