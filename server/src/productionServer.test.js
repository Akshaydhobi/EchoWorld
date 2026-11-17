const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = require("./app");

const clientBuildDirectory = path.resolve(__dirname, "../../client/dist");
const clientEntryPoint = path.join(clientBuildDirectory, "index.html");

test("production server serves the dashboard, assets, and JSON API errors", {
  skip: !fs.existsSync(clientEntryPoint) && "Run npm run build to create the production dashboard."
}, async () => {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const rootResponse = await fetch(`${baseUrl}/`);
    assert.equal(rootResponse.status, 200);
    assert.equal(rootResponse.headers.get("cache-control"), "no-cache");

    const dashboardResponse = await fetch(`${baseUrl}/research-laboratory`);
    assert.equal(dashboardResponse.status, 200);
    assert.match(dashboardResponse.headers.get("content-type"), /text\/html/);
    assert.equal(dashboardResponse.headers.get("cache-control"), "public, max-age=0");
    assert.match(await dashboardResponse.text(), /id="root"/);

    const assetName = fs.readdirSync(path.join(clientBuildDirectory, "assets"))
      .find((name) => name.startsWith("index-") && name.endsWith(".js"));
    assert.ok(assetName, "Vite should emit the dashboard JavaScript asset.");
    const assetResponse = await fetch(`${baseUrl}/assets/${assetName}`);
    assert.equal(assetResponse.status, 200);
    assert.match(assetResponse.headers.get("content-type"), /javascript/);

    const unknownApiResponse = await fetch(`${baseUrl}/api/not-a-route`);
    assert.equal(unknownApiResponse.status, 404);
    assert.match(unknownApiResponse.headers.get("content-type"), /application\/json/);
  } finally {
    const closed = new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    server.closeAllConnections();
    await closed;
  }
});
