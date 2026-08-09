"use client";

import Image from "next/image";
import Link from "next/link";
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
type NativeModelViewer = HTMLElement & { activateAR?: () => Promise<void> };

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
  const [viewerReady, setViewerReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [arMessage, setArMessage] = useState("Point your camera at a clear section of patio floor.");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const querySize = query.get("size");
    const queryFinish = query.get("finish");
    queueMicrotask(() => {
      if (isSizeSlug(querySize)) setSize(querySize);
      if (isFinishSlug(queryFinish)) setFinish(queryFinish);
      setQueryReady(true);
    });
    void import("@google/model-viewer").then(() => setViewerReady(true)).catch(() => {
      setArMessage("The 3D preview could not start. Use the iPhone / iPad AR link below or reload this page.");
    });
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

  const launchNativeAR = async () => {
    setLaunching(true);
    setArMessage("Opening your phone’s native AR viewer…");
    try {
      const modelViewer = document.querySelector<NativeModelViewer>("#coordinatez-ar-model");
      if (!modelViewer?.activateAR) throw new Error("Native AR is unavailable");
      await modelViewer.activateAR();
      setArMessage("Move your phone slowly to detect the floor, then tap to place AXIS.");
    } catch {
      setArMessage("Native AR needs a compatible iPhone, iPad, or AR-supported Android phone. The interactive 3D preview still works here.");
    } finally {
      setLaunching(false);
    }
  };

  const viewer = createElement(
    "model-viewer",
    {
      id: "coordinatez-ar-model",
      class: "native-ar-model",
      src: glb,
      "ios-src": usdz,
      alt: `${configuration.label} Coordinatez AXIS pergola in ${finishLabel}`,
      ar: true,
      "ar-modes": "webxr scene-viewer quick-look",
      "ar-scale": "fixed",
      "ar-placement": "floor",
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
    createElement("button", { className: "native-ar-slot-button", slot: "ar-button" }, "Place in your space", createElement("span", null, "↗")),
    createElement("div", { className: "native-ar-progress", slot: "progress-bar" }, createElement("i")),
  );

  return (
    <main className="native-ar-page">
      <header className="native-ar-header">
        <Link className="native-ar-brand" href="/" aria-label="Coordinatez home">COORDINATEZ</Link>
        <span>AXIS / NATIVE AR</span>
        <Link href="/#configure">Back to configurator <i>↙</i></Link>
      </header>

      <section className="native-ar-stage">
        <div className="native-ar-viewer-wrap">
          <div className="native-ar-eyebrow"><i /> True scale · 1 unit = 1 metre</div>
          {viewer}
          {!viewerReady && <div className="native-ar-loading"><i /><span>Preparing architectural model</span></div>}
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
                <button key={option.slug} className={size === option.slug ? "is-selected" : ""} onClick={() => setSize(option.slug)} aria-pressed={size === option.slug}>
                  <b>{option.label}</b><small>{option.posts}</small><i />
                </button>
              ))}
            </div>
          </div>

          <div className="native-ar-choice">
            <div className="native-ar-choice-heading"><span>02 / Finish</span><b>{finishLabel}</b></div>
            <div className="native-ar-finish-grid">
              {finishOptions.map((option) => (
                <button key={option.slug} className={finish === option.slug ? "is-selected" : ""} onClick={() => setFinish(option.slug)} aria-pressed={finish === option.slug}>
                  <i style={{ background: option.color }} /><span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="native-ar-primary" onClick={() => void launchNativeAR()} disabled={launching || !viewerReady}>
            <i aria-hidden="true">AR</i><span><b>{launching ? "Opening AR…" : "Place in your space"}</b><small>Uses your phone’s native AR viewer</small></span><em>↗</em>
          </button>
          <p className="native-ar-status" aria-live="polite">{arMessage}</p>

          <div className="native-ar-device-fallback">
            <div>
              <Image src={qr} width={62} height={62} unoptimized alt={`QR code to open the ${configuration.label} ${finishLabel} AR model on a phone`} />
              <span><b>On a computer?</b><small>Scan to keep this exact size and finish.</small></span>
            </div>
            <a rel="ar" href={usdz}>Open with iPhone / iPad AR <span>↗</span></a>
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
