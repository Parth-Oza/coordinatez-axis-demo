/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const cacheablePage = request.method === "GET" && !url.pathname.startsWith("/api/") && (request.headers.get("accept") ?? "").includes("text/html");
    if (cacheablePage && typeof caches !== "undefined" && "default" in caches) {
      const edgeCache = (caches as CacheStorage & { default: Cache }).default;
      const cacheUrl = new URL(request.url);
      cacheUrl.searchParams.set("__coordinatez_release", "v7-true-4k-pov-20260810");
      const cacheKey = new Request(cacheUrl, request);
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("X-Coordinatez-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
      }

      const response = await handler.fetch(request, env, ctx);
      if (response.ok && (response.headers.get("content-type") ?? "").includes("text/html") && !response.headers.has("set-cookie")) {
        const cacheHeaders = new Headers(response.headers);
        cacheHeaders.set("Cache-Control", "public, max-age=60, s-maxage=1800, stale-while-revalidate=86400");
        cacheHeaders.set("X-Coordinatez-Cache", "MISS");
        const cacheResponse = new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers: cacheHeaders });
        ctx.waitUntil(edgeCache.put(cacheKey, cacheResponse));
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: cacheHeaders });
      }
      return response;
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
