const API_BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** A readable message for a failed request: FastAPI's "detail" when there is one. */
export function describeApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = /^API (\d+): ([\s\S]*)$/.exec(message);
  if (!match) return message;
  try {
    const body = JSON.parse(match[2]);
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    /* not JSON: use the text as is */
  }
  return match[2] || `The request failed (${match[1]}).`;
}

/** The HTTP status of a failed request, if it came from the API helper. */
export function apiStatus(error: unknown): number | null {
  const match = /^API (\d+):/.exec(error instanceof Error ? error.message : String(error));
  return match ? Number(match[1]) : null;
}
