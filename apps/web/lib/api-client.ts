import { getStoredAccessToken } from "./auth";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  headers?: HeadersInit;
  timeoutMs?: number;
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001/api";
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const API_BASE_URL = resolveApiBaseUrl();
let hasLoggedApiBaseUrl = false;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = options.token ?? getStoredAccessToken();
  const headers = new Headers(options.headers);
  const requestUrl = buildApiUrl(path);

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  let response: Response;
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );

  try {
    response = await fetch(requestUrl, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: abortController.signal,
    });
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    const message =
      isAbortError
        ? `Request to the SW Exchange API timed out at ${API_BASE_URL}. Check that the API server is running.`
        : error instanceof Error && error.message === "Failed to fetch"
        ? `Unable to reach the SW Exchange API at ${API_BASE_URL}. Check NEXT_PUBLIC_API_URL, the API server, and browser CORS settings.`
        : "Unable to reach the SW Exchange API.";
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  const json = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message = extractErrorMessage(json) ?? `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }

  return json as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function logResolvedApiBaseUrl() {
  if (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    !hasLoggedApiBaseUrl
  ) {
    console.info(`[SW Exchange] Resolved API base URL: ${API_BASE_URL}`);
    hasLoggedApiBaseUrl = true;
  }
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Received a non-JSON response from the API.");
  }
}

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeMessage = (payload as { message?: unknown }).message;

  if (typeof maybeMessage === "string") {
    return maybeMessage;
  }

  if (Array.isArray(maybeMessage)) {
    return maybeMessage.filter((item) => typeof item === "string").join(" ");
  }

  return null;
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configuredBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  const withoutTrailingSlash = configuredBaseUrl.replace(/\/+$/, "");
  const collapsedApiSuffix = withoutTrailingSlash.replace(/(?:\/api)+$/, "/api");

  if (collapsedApiSuffix.endsWith("/api")) {
    return collapsedApiSuffix;
  }

  return `${collapsedApiSuffix}/api`;
}

function buildApiUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, `${API_BASE_URL}/`).toString();
}
