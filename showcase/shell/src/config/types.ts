/**
 * "local":     each lab runs on localhost:<port> (npm run dev / uvicorn).
 * "subdomain": each lab is served at https://<id>.<domain>, its API at /api/<id> on the shell's domain.
 */
export type UrlMode = "local" | "subdomain";

export interface LabConfig {
  id: string;
  name: string;
  description: string;
  backendPort: number;
  frontendPort: number;
  healthPath: string;
  /** Where the lab's own UI is loaded from (derived from urlMode unless set in labs.json). */
  frontendUrl: string;
  /** Base URL the shell uses for the health check (derived unless set in labs.json). */
  apiUrl: string;
}

export interface ShowcaseConfig {
  title: string;
  refreshSeconds: number;
  labs: LabConfig[];
}
