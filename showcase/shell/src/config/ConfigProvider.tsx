import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseConfig } from "./parseConfig";
import type { ShowcaseConfig } from "./types";

const CONFIG_URL = "/labs.json";

interface ConfigState {
  config: ShowcaseConfig | null;
  error: string | null;
}

const ConfigContext = createContext<ShowcaseConfig | null>(null);

async function fetchConfig(): Promise<ShowcaseConfig> {
  const response = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`GET ${CONFIG_URL} failed with ${response.status}`);
  return parseConfig(await response.json());
}

/**
 * Loads labs.json at runtime (never at build time) and re-reads it every
 * `refreshSeconds`, so editing the file updates the open UI without a rebuild
 * or a page reload. A bad edit keeps the last good config on screen.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfigState>({ config: null, error: null });
  const refreshSeconds = state.config?.refreshSeconds ?? 0;

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      fetchConfig()
        .then((config) => !cancelled && setState({ config, error: null }))
        .catch((err: Error) => !cancelled && setState((prev) => ({ ...prev, error: err.message })));

    load();
    const timer = refreshSeconds > 0 ? window.setInterval(load, refreshSeconds * 1000) : undefined;
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshSeconds]);

  if (!state.config) {
    return <div className="center">{state.error ? `Config error: ${state.error}` : "Loading…"}</div>;
  }
  return (
    <ConfigContext.Provider value={state.config}>
      {state.error && <div className="banner">Config reload failed, showing last good config: {state.error}</div>}
      {children}
    </ConfigContext.Provider>
  );
}

export function useShowcaseConfig(): ShowcaseConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error("useShowcaseConfig must be used inside <ConfigProvider>");
  return config;
}
