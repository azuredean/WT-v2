let engineBaseUrl = process.env.ENGINE_URL || "http://localhost:8000";

export function setEngineBaseUrl(url: string) {
  engineBaseUrl = url;
}

export function getEngineBaseUrl() {
  return engineBaseUrl;
}

export async function engineGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${engineBaseUrl}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function enginePost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${engineBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
