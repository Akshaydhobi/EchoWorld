const test = require("node:test");
const assert = require("node:assert/strict");
const {
  matchesArchitectToken,
  parseClientOrigins,
  parsePort,
  validateArchitectToken
} = require("./serverConfig");

test("runtime config accepts valid ports and explicit browser origins", () => {
  assert.equal(parsePort(undefined), 4000);
  assert.equal(parsePort("8080"), 8080);
  assert.deepEqual(parseClientOrigins(undefined), [
    "http://127.0.0.1:5173",
    "http://localhost:5173"
  ]);
  assert.deepEqual(
    parseClientOrigins("https://echo.example, https://echo.example"),
    ["https://echo.example"]
  );
});

test("runtime config rejects invalid ports and permissive or malformed origins", () => {
  for (const port of ["0", "65536", "abc", "4.5"]) {
    assert.throws(() => parsePort(port), TypeError);
  }
  for (const origins of ["*", "https://echo.example/app", "file://local"]) {
    assert.throws(() => parseClientOrigins(origins), TypeError);
  }
});

test("production requires a strong architect token and comparisons are timing-safe", () => {
  const token = "a".repeat(32);
  assert.equal(validateArchitectToken(undefined, "development"), null);
  assert.equal(validateArchitectToken(token, "production"), token);
  assert.throws(() => validateArchitectToken(undefined, "production"), TypeError);
  assert.throws(() => validateArchitectToken("too-short", "development"), TypeError);
  assert.equal(matchesArchitectToken(token, token), true);
  assert.equal(matchesArchitectToken("wrong-token", token), false);
  assert.equal(matchesArchitectToken(undefined, token), false);
  assert.equal(matchesArchitectToken(undefined, null), true);
});
