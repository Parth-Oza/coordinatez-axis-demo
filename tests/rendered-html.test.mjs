import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
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

test("server-renders the complete Coordinatez AXIS product experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /COORDINATEZ/);
  assert.match(html, /AXIS POWER\+ Gen 2/);
  assert.match(html, /A moving product story/);
  assert.match(html, /Made for the hours you keep/);
  assert.match(html, /Everything specified/);
  assert.match(html, /Compare the complete system/);
  assert.match(html, /Assembly, one clear chapter at a time/);
  assert.match(html, /Check your project ZIP/);
  assert.match(html, /100-day free trial/);
  assert.match(html, /10-year warranty/);
  assert.match(html, /Seven spaces\. One responsive roof/);
  assert.match(html, /See AXIS at full scale/);
  assert.match(html, /Start a project/);
  assert.equal((html.match(/class="assembly-card reveal"/g) ?? []).length, 15);
  assert.equal((html.match(/class="lifestyle-card reveal scene-/g) ?? []).length, 7);
  assert.doesNotMatch(html, /Find your structure/);
});

test("ships the comparison imagery and full-stack interaction hooks", async () => {
  const [page, arPage, css, layout, subscriberRoute, migration, arManifestText, arGenerator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ar/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/subscribers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_graceful_madame_masque.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/ar/models.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate-ar-assets.mjs", import.meta.url), "utf8"),
  ]);

  await access(new URL("../public/models-triptych.jpg", import.meta.url));
  await access(new URL("../public/hero-triptych-v2.jpg", import.meta.url));
  await access(new URL("../public/coordinatez-patio-environment.jpg", import.meta.url));
  await access(new URL("../public/coordinatez-patio-panorama-v2.png", import.meta.url));
  await access(new URL("../public/coordinatez-desert-panorama.png", import.meta.url));
  await access(new URL("../public/coordinatez-film-living.mp4", import.meta.url));
  await access(new URL("../public/coordinatez-film-control.mp4", import.meta.url));
  await access(new URL("../public/coordinatez-film-louvers.mp4", import.meta.url));
  await access(new URL("../public/coordinatez-lifestyle-pool.png", import.meta.url));
  await access(new URL("../public/coordinatez-lifestyle-family.png", import.meta.url));
  await access(new URL("../public/coordinatez-lifestyle-desert.png", import.meta.url));
  await access(new URL("../public/coordinatez-lifestyle-rain.png", import.meta.url));
  await access(new URL("../public/ar/coordinatez-axis-10x10-carbon.glb", import.meta.url));
  await access(new URL("../public/ar/coordinatez-axis-10x10-carbon.usdz", import.meta.url));
  await access(new URL("../public/ar/coordinatez-ar-qr-13x20-sand.png", import.meta.url));
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
  assert.match(page, /assemblyChapters/);
  assert.match(page, /competitorRows/);
  assert.match(page, /lifestyleScenes/);
  assert.match(page, /showroomScenes/);
  assert.match(page, /InstallationChecker/);
  assert.match(page, /ProductStudio/);
  assert.doesNotMatch(page, /requestSession\("immersive-ar"/);
  assert.doesNotMatch(page, /requestHitTestSource/);
  assert.doesNotMatch(page, /getUserMedia/);
  assert.match(page, /ar-launch-button/);
  assert.match(page, /iPhone \+ Android native AR/);
  assert.match(arPage, /@google\/model-viewer/);
  assert.match(arPage, /webxr scene-viewer quick-look/);
  assert.match(arPage, /"ios-src"/);
  assert.match(arPage, /activateAR/);
  assert.match(arPage, /canActivateAR/);
  assert.match(arPage, /"ar-scale": "fixed"/);
  assert.match(arPage, /loading: "eager"/);
  assert.match(arPage, /modelViewer\.addEventListener\("load"/);
  assert.match(arPage, /modelViewer\.loaded/);
  assert.match(arPage, /setAttribute\("src", glb\)/);
  assert.match(arPage, /allowsContentScaling=0/);
  assert.doesNotMatch(arPage, /native-ar-slot-button/);
  assert.match(arPage, /coordinatez-ar-qr-/);
  assert.equal(JSON.parse(arManifestText).length, 12);
  assert.match(arGenerator, /const postX = halfWidth - postSize \/ 2/);
  assert.match(arGenerator, /\[size\.width, beamHeight, beamDepth\]/);
  assert.match(arGenerator, /"Anchor plate"[^\n]+darkMetal/);
  assert.match(css, /models-triptych\.jpg/);
  assert.match(css, /url\("\/hero-triptych-v2\.jpg"\)/);
  assert.match(css, /hero-louver/);
  assert.match(css, /prototype-showcase/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@keyframes viewer-enter \{ from \{ opacity: 0; transform: translateX\(-18px\); \} to \{ opacity: 1; transform: none; \} \}/);
  assert.match(css, /\.site-header \{ position: relative; top: auto; height: 68px; \}/);
  assert.equal((page.match(/id="brief-title"/g) ?? []).length, 2);
  assert.match(layout, /AXIS POWER\+ Gen 2/);
  assert.match(layout, /favicon\.svg/);
  assert.match(layout, /127\.0\.0\.1/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(subscriberRoute, /newsletterSubscribers/);
  assert.match(migration, /CREATE TABLE `newsletter_subscribers`/);
});

test("server-renders the dedicated native AR handoff", async () => {
  const response = await render("/ar?size=13x20&finish=sand");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /PLACE BEFORE YOU BUILD/);
  assert.match(html, /Place in your space/);
  assert.match(html, /iPhone \/ iPad AR/);
  assert.match(html, /True scale/);
});
