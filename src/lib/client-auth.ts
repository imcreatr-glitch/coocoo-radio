/**
 * Admin auth helper for client components.
 * Stores the admin token in localStorage and sends it as x-admin-token header
 * on every admin request — works even when cookies are blocked
 * (e.g. inside preview iframes / WebViews with third-party cookie blocking).
 */
const KEY = "coocoo_admin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/** fetch with admin token header attached (falls back to cookie auth server-side) */
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("x-admin-token", token);
  return fetch(url, { ...init, headers, credentials: "same-origin" });
}
