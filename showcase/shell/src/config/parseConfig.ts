import type { LabConfig, ShowcaseConfig, UrlMode } from "./types";

type Json = Record<string, unknown>;

const DEFAULT_FRONTEND_PORT = 3000;
const LAB_ID = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

class ConfigError extends Error {}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Json, key: string, where: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(`${where}.${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(obj: Json, key: string, fallback: string): string {
  return typeof obj[key] === "string" ? (obj[key] as string) : fallback;
}

function requirePort(obj: Json, key: string, where: string, fallback?: number): number {
  const value = obj[key] ?? fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ConfigError(`${where}.${key} must be a port number`);
  }
  return value;
}

/** Derives where a lab lives from the URL mode, so labs.json only needs ids and ports. */
function labUrls(id: string, backendPort: number, frontendPort: number, mode: UrlMode, location: Location) {
  if (mode === "local") {
    return { frontendUrl: `http://localhost:${frontendPort}`, apiUrl: `http://localhost:${backendPort}` };
  }
  return { frontendUrl: `${location.protocol}//${id}.${location.host}`, apiUrl: `/api/${id}` };
}

function parseLab(raw: unknown, index: number, mode: UrlMode, location: Location): LabConfig | null {
  const where = `labs[${index}]`;
  if (!isObject(raw)) throw new ConfigError(`${where} must be an object`);

  const id = requireString(raw, "id", where);
  if (!LAB_ID.test(id)) throw new ConfigError(`${where}.id "${id}" must be lowercase letters, digits and dashes`);
  if (raw.enabled === false) return null;

  const backendPort = requirePort(raw, "backendPort", where);
  const frontendPort = requirePort(raw, "frontendPort", where, DEFAULT_FRONTEND_PORT);
  const derived = labUrls(id, backendPort, frontendPort, mode, location);

  return {
    id,
    name: requireString(raw, "name", where),
    description: optionalString(raw, "description", ""),
    backendPort,
    frontendPort,
    healthPath: optionalString(raw, "healthPath", "/"),
    frontendUrl: optionalString(raw, "frontendUrl", derived.frontendUrl).replace(/\/+$/, ""),
    apiUrl: optionalString(raw, "apiUrl", derived.apiUrl).replace(/\/+$/, ""),
  };
}

/** Validates untrusted JSON and fills defaults, so the rest of the app can trust the shape. */
export function parseConfig(raw: unknown, location: Location = window.location): ShowcaseConfig {
  if (!isObject(raw)) throw new ConfigError("labs.json must be a JSON object");
  if (!Array.isArray(raw.labs)) throw new ConfigError("labs.json: labs must be an array");

  const mode: UrlMode = raw.urlMode === "local" ? "local" : "subdomain";
  const labs = raw.labs
    .map((lab, i) => parseLab(lab, i, mode, location))
    .filter((lab): lab is LabConfig => lab !== null);

  const ids = new Set<string>();
  for (const lab of labs) {
    if (ids.has(lab.id)) throw new ConfigError(`duplicate lab id "${lab.id}"`);
    ids.add(lab.id);
  }

  return {
    title: optionalString(raw, "title", "Labs"),
    refreshSeconds: typeof raw.refreshSeconds === "number" ? raw.refreshSeconds : 0,
    labs,
  };
}
