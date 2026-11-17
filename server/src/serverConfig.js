const { timingSafeEqual } = require("node:crypto");

const DEFAULT_CLIENT_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173"
];

function parsePort(value) {
  if (value === undefined || value.trim() === "") return 4000;
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("PORT must be an integer from 1 to 65535.");
  }
  return port;
}

function parseClientOrigins(value) {
  if (value === undefined || value.trim() === "") return DEFAULT_CLIENT_ORIGINS;
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.includes("*")) {
    throw new TypeError("CLIENT_ORIGINS must contain explicit browser origins, not '*'.");
  }
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new TypeError(`CLIENT_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new TypeError(`CLIENT_ORIGINS must contain origins without paths: ${origin}`);
    }
  }
  return [...new Set(origins)];
}

function validateArchitectToken(value, nodeEnvironment = process.env.NODE_ENV) {
  const token = value?.trim() || "";
  if (!token && nodeEnvironment === "production") {
    throw new TypeError("WORLD_ARCHITECT_TOKEN is required in production.");
  }
  if (token && Buffer.byteLength(token, "utf8") < 32) {
    throw new TypeError("WORLD_ARCHITECT_TOKEN must contain at least 32 characters.");
  }
  return token || null;
}

function matchesArchitectToken(candidate, expected) {
  if (!expected) return true;
  if (typeof candidate !== "string") return false;
  const candidateBuffer = Buffer.from(candidate, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer);
}

module.exports = {
  matchesArchitectToken,
  parseClientOrigins,
  parsePort,
  validateArchitectToken
};
