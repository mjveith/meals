import { SharedStatePatch, SharedStateResponse } from "@/types";

export class SharedStateSyncError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SharedStateSyncError";
    this.status = status;
  }
}

export async function fetchSharedState(etag?: string): Promise<{
  state: SharedStateResponse | null;
  etag: string | null;
  notModified: boolean;
}> {
  const response = await fetch("/api/state", {
    method: "GET",
    cache: "no-store",
    headers: etag ? { "If-None-Match": etag } : undefined
  });

  if (response.status === 304) {
    return {
      state: null,
      etag: response.headers.get("ETag"),
      notModified: true
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch shared state: ${response.status}`);
  }

  return {
    state: (await response.json()) as SharedStateResponse,
    etag: response.headers.get("ETag"),
    notModified: false
  };
}

export async function pushSharedState(
  patch: SharedStatePatch,
  etag?: string
): Promise<{ state: SharedStateResponse; etag: string | null }> {
  const response = await fetch("/api/state", {
    method: "PUT",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(etag ? { "If-Match": etag } : {})
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    throw new SharedStateSyncError(`Failed to update shared state: ${response.status}`, response.status);
  }

  return {
    state: (await response.json()) as SharedStateResponse,
    etag: response.headers.get("ETag")
  };
}
