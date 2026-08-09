"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the framework prefetch error on this standalone AR route. */

import Image from "next/image";
import { createElement, useEffect, useState } from "react";

const sizeOptions = [
  { slug: "10x10", label: "10′ × 10′", metric: "3.05 × 3.05 m", posts: "4 posts" },
  { slug: "10x13", label: "10′ × 13′", metric: "3.05 × 3.96 m", posts: "4 posts" },
  { slug: "13x13", label: "13′ × 13′", metric: "3.96 × 3.96 m", posts: "4 posts" },
  { slug: "13x20", label: "13′ × 20′", metric: "3.96 × 6.10 m", posts: "6 posts" },
] as const;

const finishOptions = [
  { slug: "carbon", label: "Carbon", color: "#414946" },
  { slug: "cloud", label: "Cloud", color: "#d5d8d3" },
  { slug: "sand", label: "Sand", color: "#a78d67" },
] as const;

type SizeSlug = (typeof sizeOptions)[number]["slug"];
type FinishSlug = (typeof finishOptions)[number]["slug"];
type NativeModelViewer = HTMLElement & {
  activateAR?: () => Promise<void>;
  canActivateAR?: boolean;
  loaded?: boolean;
  updateComplete?: Promise<unknown>;
};

type ModelViewerEvent = Event & { detail?: { status?: string; url?: string } };

function isSizeSlug(value: string | null): value is SizeSlug {
  return sizeOptions.some((option) => option.slug === value);
}

function isFinishSlug(value: string | null): value is FinishSlug {
  return finishOptions.some((option) => option.slug === value);
}

export default function AugmentedRealityPage() {
  const [size, setSize] = useState<SizeSlug>("10x13");
  const [finish, setFinish] = useState<FinishSlug>("carbon");
  const [queryReady, setQueryReady] = useState(false);
  const [viewerDefined, setViewerDefined] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState("");
  const [arAvailable, setArAvailable] = useState<boolean | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [arMessage, setArMessage] = useState("Preparing the true-scale 3D model…");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const querySize = query.get("size");
    const queryFinish = query.get("finish");
    queueMicrotask(() => {
      if (isSizeSlug(querySize)) setSize(querySize);
      if (isFinishSlug(queryFinish)) setFinish(queryFinish);
      setQueryReady(true);
    });
    let active = true;
    void import("@google/model-viewer")
      .then(() => customElements.whenDefined("model-viewer"))
      .then(() => { if (active) setViewerDefined(true); })
      .catch(() => {
        if (!active) return;
        setModelError("The interactive viewer could not start.");
        setArMessage("Use a direct iPhone or Android model link below, or reload this page.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!queryReady) return;
    const url = new URL(window.location.href);
    url.searchParams.set("size", size);
    url.searchParams.set("finish", finish);
    window.history.replaceState({}, "", url);
  }, [finish, queryReady, size]);

  const configuration = sizeOptions.find((option) => option.slug === size) ?? sizeOptions[1];
  const finishLabel = finishOptions.find((option) => option.slug === finish)?.label ?? "Carbon";
  const basename = `coordinatez-axis-${size}-${finish}`;
  const glb = `/ar/${basename}.glb`;
  const usdz = `/ar/${basename}.usdz`;
  const qr = `/ar/coordinatez-ar-qr-${size}-${finish}.png`;
  const quickLookHref = `${usdz}#allowsContentScaling=0`;

  useEffect(() => {
    if (!queryReady || !viewerDefined) return;
    const modelViewer = document.querySelector<NativeModelViewer>("#coordinatez-ar-model");
    if (!modelViewer) return;

    let active = true;

    const handleLoad = (event: Event) => {
      if (!active) return;
      const loadedUrl = (event as ModelViewerEvent).detail?.url;
      if (loadedUrl && new URL(loadedUrl, window.location.href).pathname !== glb) return;
      setModelReady(true);
      setModelError("");
      const available = Boolean(modelViewer.canActivateAR);
      setArAvailable(available);
      setArMessage(available
        ? "AR is ready. Point your camera at a clear section of patio floor."
        : "3D is ready. Open this page on an AR-compatible phone to place AXIS at full scale.");
    };
    const handleError = () => {
      if (!active) return;
      setModelReady(false);
      setModelError("This 3D model could not be loaded.");
      setArMessage("Check your connection, retry the model, or use a direct model link below.");
    };
    const handleArStatus = (event: Event) => {
      if (!active) return;
      const status = (event as ModelViewerEvent).detail?.status;
      if (status === "session-started") setArMessage("AR opened. Move slowly to detect the floor, then tap to place AXIS.");
      if (status === "object-placed") setArMessage("AXIS is placed at true scale. Walk the perimeter to check clearance.");
      if (status === "failed") setArMessage("Native AR could not start in this browser. Try Chrome on Android or Safari on iPhone.");
    };
    const handleArTracking = (event: Event) => {
      if (!active) return;
      const status = (event as ModelViewerEvent).detail?.status;
      if (status === "not-tracking") setArMessage("Move the phone more slowly and keep the patio floor in view.");
      if (status === "tracking") setArMessage("Floor detected. Tap once to place AXIS at true scale.");
    };

    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);
    modelViewer.addEventListener("ar-status", handleArStatus);
    modelViewer.addEventListener("ar-tracking", handleArTracking);

    modelViewer.removeAttribute("src");
    modelViewer.setAttribute("src", glb);
    modelViewer.setAttribute("ios-src", usdz);
    modelViewer.setAttribute("alt", `${configuration.label} Coordinatez AXIS pergola in ${finishLabel}`);

    void Promise.resolve(modelViewer.updateComplete).then(() => {
      if (!active) return;
      setArAvailable(Boolean(modelViewer.canActivateAR));
      if (modelViewer.loaded) handleLoad(new CustomEvent("load", { detail: { url: glb } }));
    });

    return () => {
      active = false;
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
      modelViewer.removeEventListener("ar-status", handleArStatus);
      modelViewer.removeEventListener("ar-tracking", handleArTracking);
    };
  }, [configuration.label, finishLabel, glb, queryReady, retryToken, usdz, viewerDefined]);

  const launchNativeAR = async () => {
    const modelViewer = document.querySelector<NativeModelViewer>("#coordinatez-ar-model");
    if (!modelReady) {
      setArMessage("Wait for the 3D model to finish loading before opening AR.");
      return;
    }
    if (!modelViewer?.activateAR || !modelViewer.canActivateAR) {
      setArAvailable(false);
      setArMessage("Native AR is unavailable in this browser. Use Safari on iPhone or Chrome on an AR-supported Android phone.");
      document.querySelector(".native-ar-device-fallback")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLaunching(true);
    setArMessage("Opening your phone’s native AR viewer…");
    try {
      await modelViewer.activateAR();
      setArMessage("AR viewer opened. Move slowly to detect the floor, then tap to place AXIS.");
    } catch {
      setArMessage("AR could not open. Try Safari on iPhone or Chrome on an AR-supported Android phone.");
    } finally {
      setLaunching(false);
    }
  };

  const primaryLabel = launching ? "Opening AR…" : arAvailable === false ? "Open on your phone" : "Place in your space";
  const primaryHint = arAvailable === false ? "Safari on iPhone · Chrome on Android" : "True-scale iPhone + Android AR";
  const prepareModelChange = (message: string) => {
    setModelReady(false);
    setModelError("");
    setArAvailable(null);
    setArMessage(message);
  };
  const retryModel = () => {
    prepareModelChange(`Retrying the ${configuration.label} ${finishLabel} model…`);
    setRetryToken((value) => value + 1);
  };

  const viewer = createElement(
    "model-viewer",
    {
      id: "coordinatez-ar-model",
      class: "native-ar-model",
      alt: `${configuration.label} Coordinatez AXIS pergola in ${finishLabel}`,
      ar: true,
      "ar-modes": "webxr scene-viewer quick-look",
      "ar-scale": "fixed",
      "ar-placement": "floor",
      loading: "eager",
      "camera-controls": true,
      "auto-rotate": true,
      "auto-rotate-delay": "650",
      "rotation-per-second": "10deg",
      "shadow-intensity": "1.25",
      "shadow-softness": "0.7",
      exposure: "1.05",
      "environment-image": "neutral",
      "camera-orbit": "38deg 66deg auto",
      "min-camera-orbit": "auto 28deg auto",
      "max-camera-orbit": "auto 88deg auto",
      "interaction-prompt": "auto",
      "touch-action": "pan-y",
    },
    createElement("div", { className: "native-ar-progress", slot: "progress-bar" }, createElement("i")),
  );

  return (
    <main className="native-ar-page">
      <header className="native-ar-header">
        <a className="native-ar-brand" href="/" aria-label="Coordinatez home">COORDINATEZ</a>
        <span>AXIS / NATIVE AR</span>
        <a href="/#configure">Back to configurator <i>↙</i></a>
      </header>

      <section className="native-ar-stage">
        <div className="native-ar-viewer-wrap">
          <div className="native-ar-eyebrow"><i /> True scale · 1 unit = 1 metre</div>
          {viewer}
          {!modelReady && (
            <div className={`native-ar-loading ${modelError ? "is-error" : ""}`} role={modelError ? "alert" : undefined}>
              {modelError ? (
                <><b>3D preview unavailable</b><span>{modelError}</span><button onClick={retryModel}>Retry model</button></>
              ) : (
                <><i /><span>Preparing architectural model</span></>
              )}
            </div>
          )}
          <div className="native-ar-viewer-caption">
            <span>{configuration.label}</span>
            <b>AXIS POWER+ / {finishLabel}</b>
          </div>
        </div>

        <aside className="native-ar-controls">
          <div className="native-ar-intro">
            <small>PLACE BEFORE YOU BUILD</small>
            <h1>See AXIS on<br />your patio.</h1>
            <p>This is a true-scale architectural preview with the frame, louvers, motorized screens, L-sofa, table and BBQ included.</p>
          </div>

          <div className="native-ar-choice">
            <div className="native-ar-choice-heading"><span>01 / Footprint</span><b>{configuration.metric}</b></div>
            <div className="native-ar-size-grid">
              {sizeOptions.map((option) => (
                <button key={option.slug} className={size === option.slug ? "is-selected" : ""} onClick={() => {
                  if (size === option.slug) return;
                  prepareModelChange(`Loading the ${option.label} ${finishLabel} model…`);
                  setSize(option.slug);
                }} aria-pressed={size === option.slug}>
                  <b>{option.label}</b><small>{option.posts}</small><i />
                </button>
              ))}
            </div>
          </div>

          <div className="native-ar-choice">
            <div className="native-ar-choice-heading"><span>02 / Finish</span><b>{finishLabel}</b></div>
            <div className="native-ar-finish-grid">
              {finishOptions.map((option) => (
                <button key={option.slug} className={finish === option.slug ? "is-selected" : ""} onClick={() => {
                  if (finish === option.slug) return;
                  prepareModelChange(`Loading the ${configuration.label} ${option.label} model…`);
                  setFinish(option.slug);
                }} aria-pressed={finish === option.slug}>
                  <i style={{ background: option.color }} /><span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="native-ar-primary" onClick={() => void launchNativeAR()} disabled={launching || !modelReady}>
            <i aria-hidden="true">AR</i><span><b>{primaryLabel}</b><small>{primaryHint}</small></span><em>↗</em>
          </button>
          <p className="native-ar-status" aria-live="polite">{arMessage}</p>

          <div className="native-ar-device-fallback">
            <div>
              <Image src={qr} width={62} height={62} unoptimized alt={`QR code to open the ${configuration.label} ${finishLabel} AR model on a phone`} />
              <span><b>On a computer?</b><small>Scan to keep this exact size and finish.</small></span>
            </div>
            <div className="native-ar-fallback-links">
              <a rel="ar" href={quickLookHref}>
                <Image className="native-ar-quicklook-probe" src="/favicon.svg" width={1} height={1} alt="" aria-hidden="true" />
                <span>Open with iPhone / iPad AR</span><em>↗</em>
              </a>
              <a href={glb} download={`${basename}.glb`}><span>Download Android / GLB model</span><em>↓</em></a>
            </div>
          </div>
        </aside>
      </section>

      <section className="native-ar-steps" aria-label="How to place the pergola">
        <article><span>01</span><div><b>Move slowly</b><p>Point down and sweep across a clear patio surface so the phone can detect the floor.</p></div></article>
        <article><span>02</span><div><b>Tap to place</b><p>Place the model at the nearest anchor point. The dimensions remain fixed at real scale.</p></div></article>
        <article><span>03</span><div><b>Walk the perimeter</b><p>Check posts, clearance, furniture, screens and sightlines from every angle.</p></div></article>
      </section>
    </main>
  );
}
