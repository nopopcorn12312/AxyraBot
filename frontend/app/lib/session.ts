const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";

const SESSION_KEY = "axyra.session";

/** The signed session token the backend issued at Twitch login, if any. */
export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string) {
  window.localStorage.setItem(SESSION_KEY, token);
}

/**
 * Trades the one-time code from the Twitch login redirect for a session
 * token. The token itself never travels in a URL.
 */
export async function exchangeLoginCode(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return false;
    const data: { session?: string } = await res.json();
    if (!data.session) return false;
    setSessionToken(data.session);
    return true;
  } catch {
    return false;
  }
}

/**
 * Revokes the session on the backend (so a copied token stops working) and
 * forgets it locally. Safe to call without awaiting from logout handlers.
 */
export function revokeSession() {
  const token = getSessionToken();
  window.localStorage.removeItem(SESSION_KEY);
  if (!token) return;
  fetch(`${backendUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {});
}

function logOutAndGoHome() {
  const prevLogin = window.localStorage.getItem("axyra.login") ?? "";
  if (prevLogin) window.localStorage.setItem("axyra.lastLogin", prevLogin);
  window.localStorage.removeItem("axyra.login");
  window.localStorage.removeItem("axyra.avatar");
  revokeSession();
  if (window.location.pathname !== "/") window.location.href = "/";
}

let installed = false;

/**
 * Patches window.fetch so every request to the backend carries the session
 * token, and a 401 (missing or expired session) logs the user out instead of
 * leaving pages half-broken. Called at module load so it's in place before
 * any page effect fires a request.
 */
export function installSessionFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(backendUrl)) return originalFetch(input, init);

    const token = getSessionToken();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    const res = await originalFetch(input, { ...init, headers });
    if (res.status === 401 && window.localStorage.getItem("axyra.login")) logOutAndGoHome();
    return res;
  };
}

installSessionFetch();
