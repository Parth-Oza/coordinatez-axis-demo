import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Coordinatez model comparison experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /COORDINATEZ/);
  assert.match(html, /Gen 2 Motorized Pergola/);
  assert.match(html, /Gen 1 Motorized Pergola/);
  assert.match(html, /AXIS PRO Motorized Pergola/);
  assert.match(html, /View model/);
  assert.match(html, /Start a project/);
  assert.equal((html.match(/class="range-card range-reveal(?: is-visible)?"/g) ?? []).length, 4);
});

test("ships the comparison imagery and interactive studio hooks", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  await access(new URL("../public/models-triptych.jpg", import.meta.url));
  assert.match(page, /<PergolaViewer/);
  assert.match(page, /model-studio-dialog/);
  assert.match(page, /IntersectionObserver/);
  assert.match(page, /\/api\/briefs/);
  assert.match(css, /models-triptych\.jpg/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(layout, /Motorized Pergola Model Range/);
});
