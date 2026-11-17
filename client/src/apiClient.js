const TOKEN_KEY = "echoworld.world-architect-token";

export function getArchitectToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setArchitectToken(token) {
  const normalized = token.trim();
  if (normalized) {
    sessionStorage.setItem(TOKEN_KEY, normalized);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function apiFetch(input, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getArchitectToken();
  if (token) headers.set("X-Architect-Token", token);
  return fetch(input, { ...options, headers });
}
