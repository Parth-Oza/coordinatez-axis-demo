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
  assert.match(html, /Shape the light/);
  assert.match(html, /Interactive model range/);
  assert.match(html, /A moving product story/);
  assert.match(html, /Made for the hours you keep/);
  assert.match(html, /AXIS PRO Motorized Pergola/);
  assert.match(html, /View model/);
  assert.match(html, /Start a project/);
  assert.equal((html.match(/class="range-card range-reveal(?: is-visible)?"/g) ?? []).length, 4);
});

test("ships the comparison imagery and full-stack interaction hooks", async () => {
  const [page, css, layout, subscriberRoute, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/subscribers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_graceful_madame_masque.sql", import.meta.url), "utf8"),
  ]);

  await access(new URL("../public/models-triptych.jpg", import.meta.url));
  await access(new URL("../public/hero-triptych-v2.jpg", import.meta.url));
  await access(new URL("../public/coordinatez-patio-environment.jpg", import.meta.url));
  await access(new URL("../public/coordinatez-patio-panorama-v2.png", import.meta.url));
  await access(new URL("../public/coordinatez-desert-panorama.png", import.meta.url));
  await access(new URL("../public/coordinatez-film-living.mp4", import.meta.url));
  await access(new URL("../public/coordinatez-film-control.mp4", import.meta.url));
  await access(new URL("../public/coordinatez-film-louvers.mp4", import.meta.url));
  assert.match(page, /<RealPergolaViewer/);
  assert.match(page, /THREE\.WebGLRenderer/);
  assert.match(page, /OrbitControls/);
  assert.match(page, /RoundedBoxGeometry/);
  assert.match(page, /EquirectangularReflectionMapping/);
  assert.match(page, /backgroundRotation/);
  assert.match(page, /stoneBumpTexture/);
  assert.match(page, /ExtrudeGeometry/);
  assert.match(page, /footprintProfiles/);
  assert.match(page, /footprint\.posts === 6/);
  assert.match(page, /contactShadowMaterial/);
  assert.match(page, /sideWallParts/);
  assert.match(page, /screenTexture/);
  assert.match(page, /WallSidePicker/);
  assert.match(page, /addScreenAssembly\("front"/);
  assert.match(page, /addScreenAssembly\("rear"/);
  assert.match(page, /addScreenAssembly\("left"/);
  assert.match(page, /addScreenAssembly\("right"/);
  assert.match(page, /playMechanismSound/);
  assert.match(page, /ThemePicker/);
  assert.match(page, /coordinatez-desert-panorama\.png/);
  assert.doesNotMatch(page, /addLoungeChair/);
  assert.match(page, /addPatioSofa/);
  assert.match(page, /const sofaWidth = 3\.46/);
  assert.match(page, /chaiseCushion/);
  assert.match(page, /barbecue/);
  assert.match(page, /model-studio-dialog/);
  assert.match(page, /IntersectionObserver/);
  assert.match(page, /\/api\/briefs/);
  assert.match(page, /\/api\/subscribers/);
  assert.match(page, /model-search-dialog/);
  assert.match(page, /prototypeFilms/);
  assert.match(page, /coordinatez-film-living\.mp4/);
  assert.match(css, /models-triptych\.jpg/);
  assert.match(css, /url\("\/hero-triptych-v2\.jpg"\)/);
  assert.match(css, /hero-louver/);
  assert.match(css, /prototype-showcase/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(layout, /Interactive Outdoor Systems/);
  assert.match(subscriberRoute, /newsletterSubscribers/);
  assert.match(migration, /CREATE TABLE `newsletter_subscribers`/);
});
