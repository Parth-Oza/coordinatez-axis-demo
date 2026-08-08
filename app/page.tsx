"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

declare const __BRIEF_API_URL_B64__: string | undefined;

type Vec3 = { x: number; y: number; z: number };
type Face = { points: { x: number; y: number }[]; depth: number; color: string };
type BriefForm = {
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  notes: string;
  consent: boolean;
  companyWebsite: string;
};

const emptyBrief: BriefForm = {
  name: "",
  email: "",
  phone: "",
  postalCode: "",
  notes: "",
  consent: false,
  companyWebsite: "",
};

const sizes = [
  { label: "10′ × 10′", meta: "4 posts", price: 6890 },
  { label: "10′ × 13′", meta: "4 posts", price: 7790 },
  { label: "13′ × 13′", meta: "4 posts", price: 9290 },
  { label: "13′ × 20′", meta: "6 posts", price: 13490 },
];

const finishes = [
  { name: "Carbon", value: "#343a38" },
  { name: "Cloud", value: "#d5d8d3" },
  { name: "Sand", value: "#a78d67" },
];

const featureCards = [
  {
    index: "01",
    title: "Weather-reactive louvers",
    copy: "A quiet linear drive turns every blade together, moving from filtered light to full cover in seconds.",
  },
  {
    index: "02",
    title: "Power, hidden in plain sight",
    copy: "Integrated lighting and outlets run through the frame—no exposed conduit, extension leads, or visual clutter.",
  },
  {
    index: "03",
    title: "Engineered drainage",
    copy: "Rain is gathered at the roof edge and carried internally through the posts to keep the space below composed.",
  },
];

const modelComparison = [
  ["Wind rating", "90 mph", "135 mph", "Site specific"],
  ["Snow load", "20 psf", "40 psf", "Engineered"],
  ["Maximum span", "13′ × 20′", "16′ × 26′", "Made to measure"],
  ["Controls", "Remote", "App + remote", "Smart home"],
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shade(hex: string, amount: number, alpha = 1) {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw, 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgba(${r},${g},${b},${alpha})`;
}

function PergolaViewer({
  finish,
  louversOpen,
  yardVisible,
  dusk,
}: {
  finish: string;
  louversOpen: boolean;
  yardVisible: boolean;
  dusk: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(-0.55);
  const pitchRef = useRef(0.58);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const userMovedRef = useRef(false);
  const bladeAngleRef = useRef(0.08);

  const resetView = useCallback(() => {
    yawRef.current = -0.55;
    pitchRef.current = 0.58;
    userMovedRef.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let previous = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(bounds.width * dpr) || canvas.height !== Math.round(bounds.height * dpr)) {
        canvas.width = Math.round(bounds.width * dpr);
        canvas.height = Math.round(bounds.height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = bounds.width;
      const height = bounds.height;
      const elapsed = Math.min(40, now - previous);
      previous = now;

      if (!draggingRef.current && !userMovedRef.current && !reducedMotion) {
        yawRef.current = -0.55 + Math.sin(now * 0.00022) * 0.16;
      }

      const targetAngle = louversOpen ? 1.1 : 0.08;
      bladeAngleRef.current += (targetAngle - bladeAngleRef.current) * Math.min(0.14, elapsed * 0.0045);

      context.clearRect(0, 0, width, height);
      if (!yardVisible) {
        const studio = context.createLinearGradient(0, 0, 0, height);
        studio.addColorStop(0, dusk ? "#242a2a" : "#ecefeb");
        studio.addColorStop(0.58, dusk ? "#3d413e" : "#e2e0d9");
        studio.addColorStop(1, dusk ? "#171b1a" : "#c7bba7");
        context.fillStyle = studio;
        context.fillRect(0, 0, width, height);
      }

      context.save();
      context.translate(width / 2, height * 0.72);
      context.scale(1, 0.28);
      const shadow = context.createRadialGradient(0, 0, 10, 0, 0, width * 0.34);
      shadow.addColorStop(0, "rgba(0,0,0,.28)");
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = shadow;
      context.beginPath();
      context.arc(0, 0, width * 0.34, 0, Math.PI * 2);
      context.fill();
      context.restore();

      const faces: Face[] = [];
      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const focal = Math.max(530, width * 0.95);
      const scaleBase = Math.min(width / 560, height / 430) * 0.88;

      const project = (point: Vec3) => {
        const x1 = point.x * cy - point.y * sy;
        const y1 = point.x * sy + point.y * cy;
        const z1 = point.z;
        const y2 = y1 * cp - z1 * sp;
        const z2 = y1 * sp + z1 * cp;
        const perspective = focal / (focal + y2);
        return {
          x: width / 2 + x1 * perspective * scaleBase,
          y: height * 0.67 - z2 * perspective * scaleBase,
          depth: y2,
        };
      };

      const addBox = (
        center: Vec3,
        size: Vec3,
        color: string,
        localRotationX = 0,
        alpha = 1,
      ) => {
        const points: Vec3[] = [];
        for (const zSign of [-1, 1]) {
          for (const ySign of [-1, 1]) {
            for (const xSign of [-1, 1]) {
              let x = (size.x / 2) * xSign;
              let y = (size.y / 2) * ySign;
              let z = (size.z / 2) * zSign;
              if (localRotationX) {
                const c = Math.cos(localRotationX);
                const s = Math.sin(localRotationX);
                const nextY = y * c - z * s;
                const nextZ = y * s + z * c;
                y = nextY;
                z = nextZ;
              }
              points.push({ x: x + center.x, y: y + center.y, z: z + center.z });
            }
          }
        }
        const mapped = points.map(project);
        const boxFaces = [
          { ids: [0, 1, 3, 2], tint: -28 },
          { ids: [4, 6, 7, 5], tint: 28 },
          { ids: [0, 4, 5, 1], tint: -10 },
          { ids: [2, 3, 7, 6], tint: 12 },
          { ids: [0, 2, 6, 4], tint: -18 },
          { ids: [1, 5, 7, 3], tint: 5 },
        ];
        for (const side of boxFaces) {
          const facePoints = side.ids.map((id) => mapped[id]);
          faces.push({
            points: facePoints,
            depth: facePoints.reduce((sum, point) => sum + point.depth, 0) / facePoints.length,
            color: shade(color, side.tint, alpha),
          });
        }
      };

      const postZ = 110;
      for (const x of [-186, 186]) {
        for (const y of [-103, 103]) {
          addBox({ x, y, z: postZ }, { x: 18, y: 18, z: 220 }, finish);
        }
      }
      addBox({ x: 0, y: -103, z: 222 }, { x: 390, y: 22, z: 26 }, finish);
      addBox({ x: 0, y: 103, z: 222 }, { x: 390, y: 22, z: 26 }, finish);
      addBox({ x: -186, y: 0, z: 222 }, { x: 22, y: 212, z: 26 }, finish);
      addBox({ x: 186, y: 0, z: 222 }, { x: 22, y: 212, z: 26 }, finish);

      for (let i = 0; i < 14; i += 1) {
        const y = -88 + i * 13.55;
        addBox({ x: 0, y, z: 222 }, { x: 354, y: 12, z: 5 }, shade(finish, 18), bladeAngleRef.current);
      }

      if (dusk) {
        addBox({ x: 0, y: -92, z: 207 }, { x: 335, y: 3, z: 2 }, "#f2c779", 0, 0.96);
        addBox({ x: 0, y: 92, z: 207 }, { x: 335, y: 3, z: 2 }, "#f2c779", 0, 0.96);
      }

      faces.sort((a, b) => b.depth - a.depth);
      for (const face of faces) {
        context.beginPath();
        context.moveTo(face.points[0].x, face.points[0].y);
        for (let i = 1; i < face.points.length; i += 1) context.lineTo(face.points[i].x, face.points[i].y);
        context.closePath();
        context.fillStyle = face.color;
        context.fill();
        context.strokeStyle = dusk ? "rgba(255,255,255,.035)" : "rgba(23,29,27,.08)";
        context.lineWidth = 0.55;
        context.stroke();
      }

      context.fillStyle = dusk ? "rgba(255,255,255,.72)" : "rgba(20,27,24,.64)";
      context.font = "500 11px Arial, sans-serif";
      context.letterSpacing = "1px";
      context.fillText("DRAG TO ORBIT", 22, height - 22);
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [dusk, finish, louversOpen, yardVisible]);

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    userMovedRef.current = true;
    lastRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const dx = event.clientX - lastRef.current.x;
    const dy = event.clientY - lastRef.current.y;
    yawRef.current += dx * 0.008;
    pitchRef.current = Math.max(0.36, Math.min(1.05, pitchRef.current + dy * 0.004));
    lastRef.current = { x: event.clientX, y: event.clientY };
  };

  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="viewer-shell">
      <div
        className={`viewer-environment ${yardVisible ? "is-visible" : ""} ${dusk ? "is-dusk" : ""}`}
        aria-hidden="true"
      />
      <div className="viewer-topline">
        <span><i /> Interactive 3D model</span>
        <button onClick={resetView} aria-label="Reset 3D view">Reset view ↗</button>
      </div>
      <canvas
        ref={canvasRef}
        className="product-canvas"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        aria-label="Interactive three-dimensional model of the Coordinatez Axis pergola. Drag to rotate."
      />
      <div className="viewer-badge">Real-time configuration</div>
    </div>
  );
}

function Toggle({
  active,
  onChange,
  label,
}: {
  active: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button className={`toggle ${active ? "is-on" : ""}`} onClick={onChange} aria-pressed={active}>
      <span className="toggle-track"><span /></span>
      {label}
    </button>
  );
}

export default function Home() {
  const [selectedSize, setSelectedSize] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(0);
  const [louversOpen, setLouversOpen] = useState(false);
  const [yardVisible, setYardVisible] = useState(true);
  const [dusk, setDusk] = useState(false);
  const [heater, setHeater] = useState(false);
  const [screens, setScreens] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState<BriefForm>(emptyBrief);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [reference, setReference] = useState("");

  const total = useMemo(
    () => sizes[selectedSize].price + (heater ? 798 : 0) + (screens ? 1190 : 0),
    [heater, screens, selectedSize],
  );

  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.14 },
    );
    document.querySelectorAll(".reveal").forEach((element) => reveal.observe(element));
    return () => reveal.disconnect();
  }, []);

  const addToBrief = () => {
    setSubmitState("idle");
    setSubmitMessage("");
    setBriefOpen(true);
  };

  useEffect(() => {
    if (!briefOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setBriefOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [briefOpen]);

  const submitBrief = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("sending");
    setSubmitMessage("");
    const apiBase = typeof __BRIEF_API_URL_B64__ === "string" ? window.atob(__BRIEF_API_URL_B64__).replace(/\/$/, "") : "";

    try {
      const response = await fetch(`${apiBase}/api/briefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...brief,
          configuration: {
            product: "AXIS Motorized Pergola",
            finish: finishes[selectedFinish].name,
            size: sizes[selectedSize].label,
            price: total,
            louversOpen,
            eveningLight: dusk,
            heaters: heater,
            privacyScreen: screens,
          },
        }),
      });
      const result = (await response.json()) as { error?: string; reference?: string };
      if (!response.ok) throw new Error(result.error || "We could not send your project brief.");
      setReference(result.reference ?? "RECEIVED");
      setSubmitState("success");
      setToast(true);
      window.setTimeout(() => setToast(false), 3600);
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "We could not send your project brief.");
      setSubmitState("error");
    }
  };

  return (
    <div className={dusk ? "site dusk-mode" : "site"}>
      <div className="scroll-line" aria-hidden="true" />
      <div className="announcement">
        <span>THE SUMMER STUDIO</span>
        <p>Complimentary delivery on every Axis configuration.</p>
        <a href="#configure">Explore the system →</a>
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Coordinatez home">COORDINATEZ<span>®</span></a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Main navigation">
          <a href="#configure" onClick={() => setMenuOpen(false)}>Configure</a>
          <a href="#engineering" onClick={() => setMenuOpen(false)}>Engineering</a>
          <a href="#models" onClick={() => setMenuOpen(false)}>Models</a>
          <a href="#stories" onClick={() => setMenuOpen(false)}>Spaces</a>
        </nav>
        <div className="header-actions">
          <button className="text-button" onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}>Book a studio call</button>
          <button className="round-button" aria-label="Open project bag" onClick={addToBrief}>0</button>
          <button className="menu-button" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="product-section" id="configure">
          <div className="visual-column">
            <PergolaViewer
              finish={finishes[selectedFinish].value}
              louversOpen={louversOpen}
              yardVisible={yardVisible}
              dusk={dusk}
            />
            <div className="viewer-controls" aria-label="3D model controls">
              <Toggle active={louversOpen} onChange={() => setLouversOpen(!louversOpen)} label="Open louvers" />
              <Toggle active={yardVisible} onChange={() => setYardVisible(!yardVisible)} label="Show landscape" />
              <Toggle active={dusk} onChange={() => setDusk(!dusk)} label="Evening light" />
            </div>
          </div>

          <div className="configurator">
            <div className="eyebrow-row">
              <span>Coordinatez outdoor systems</span>
              <span>Concept 01 / 04</span>
            </div>
            <h1>AXIS<span>™</span> Motorized Pergola</h1>
            <div className="rating-row">
              <span className="stars">★★★★★</span>
              <a href="#stories">4.9 / studio concept</a>
            </div>
            <div className="price-line">From {money(sizes[selectedSize].price)}</div>
            <p className="lead-copy">A precision-built outdoor room that reads the weather, controls the light, and makes the open air feel architectural.</p>
            <ul className="feature-list">
              <li><span>01</span> Motorized 135° aluminum louvers</li>
              <li><span>02</span> Integrated rain and lighting channels</li>
              <li><span>03</span> Rated for wind up to 90 mph</li>
            </ul>

            <div className="option-group">
              <div className="option-heading"><span>Layout</span><b>Freestanding</b></div>
              <button className="layout-option is-selected">
                <span className="layout-glyph"><i /><i /><i /><i /></span>
                <span><b>Freestanding</b><small>Four-post structural frame</small></span>
                <em>✓</em>
              </button>
            </div>

            <div className="option-group">
              <div className="option-heading"><span>Finish</span><b>{finishes[selectedFinish].name}</b></div>
              <div className="finish-options">
                {finishes.map((finish, index) => (
                  <button
                    key={finish.name}
                    className={selectedFinish === index ? "is-selected" : ""}
                    onClick={() => setSelectedFinish(index)}
                    aria-label={`Select ${finish.name} finish`}
                  >
                    <i style={{ background: finish.value }} />
                    <span>{finish.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group">
              <div className="option-heading"><span>Footprint</span><button>View dimensions ↗</button></div>
              <div className="size-grid">
                {sizes.map((size, index) => (
                  <button
                    key={size.label}
                    className={selectedSize === index ? "is-selected" : ""}
                    onClick={() => setSelectedSize(index)}
                  >
                    <b>{size.label}</b><small>{size.meta}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group">
              <div className="option-heading"><span>Complete the room</span><b>Optional</b></div>
              <label className="addon">
                <input type="checkbox" checked={heater} onChange={(event) => setHeater(event.target.checked)} />
                <span className="checkmark" />
                <span><b>Dual radiant heaters</b><small>2 × 1500W · graphite</small></span>
                <strong>+ $798</strong>
              </label>
              <label className="addon">
                <input type="checkbox" checked={screens} onChange={(event) => setScreens(event.target.checked)} />
                <span className="checkmark" />
                <span><b>Motorized privacy screen</b><small>One 13′ elevation</small></span>
                <strong>+ $1,190</strong>
              </label>
            </div>

            <div className="purchase-block">
              <div><span>Configured total</span><strong>{money(total)}</strong></div>
              <button onClick={addToBrief}>Add to project brief <span>→</span></button>
              <p><i /> Your configuration is attached automatically.</p>
            </div>
          </div>
        </section>

        <section className="signal-strip" aria-label="Product highlights">
          <span>135° LOUVER MOTION</span><i>✦</i><span>CONCEALED DRAINAGE</span><i>✦</i><span>SMART WEATHER CONTROL</span><i>✦</i><span>10-YEAR STRUCTURAL COVER</span>
        </section>

        <section className="performance-section" id="engineering">
          <div className="performance-intro reveal">
            <span className="section-kicker">Engineered around the elements</span>
            <h2>Built to change<br />with the sky.</h2>
            <p>Axis turns a patio into a responsive environment. Light, shade, air and water are handled by one deliberately quiet structure.</p>
          </div>
          <div className="sun-dial reveal" aria-hidden="true">
            <div className="sun" />
            <div className="dial-structure">
              {Array.from({ length: 11 }).map((_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
            </div>
            <span>0°</span><span>135°</span>
          </div>
          <div className="performance-grid">
            {featureCards.map((card) => (
              <article key={card.index} className="feature-card reveal">
                <span>{card.index}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
                <a href="#models">Explore detail <b>↗</b></a>
              </article>
            ))}
          </div>
        </section>

        <section className="numbers-section reveal">
          <div><strong>12 sec</strong><span>Open to closed</span></div>
          <div><strong>90 mph</strong><span>Wind resistance</span></div>
          <div><strong>20 psf</strong><span>Snow load</span></div>
          <div><strong>10 yr</strong><span>Frame coverage</span></div>
        </section>

        <section className="detail-story" id="stories">
          <div className="detail-visual reveal">
            <div className="architectural-frame">
              <div className="shadow-room"><span /><span /><span /><span /><span /><span /><span /></div>
              <div className="chair-shape" />
              <div className="plant-shape"><i /><i /><i /></div>
            </div>
            <span className="image-caption">Designed for long afternoons / rendered in real time</span>
          </div>
          <div className="detail-copy reveal">
            <span className="section-kicker">From shade to shelter</span>
            <h2>One structure.<br />Four seasons.</h2>
            <p>Every line serves the experience below it. The louvers seal against rain, open for ventilation, and cast a changing rhythm of shadow throughout the day.</p>
            <div className="mini-specs">
              <div><b>01</b><span>Aircraft-grade aluminum frame</span></div>
              <div><b>02</b><span>Low-noise linear motor system</span></div>
              <div><b>03</b><span>Dimmable perimeter lighting</span></div>
            </div>
            <button onClick={() => document.querySelector("#configure")?.scrollIntoView({ behavior: "smooth" })}>Return to 3D studio →</button>
          </div>
        </section>

        <section className="models-section" id="models">
          <div className="models-heading reveal">
            <span className="section-kicker">Find your structure</span>
            <h2>Three levels of performance.</h2>
            <p>Start with the space. Match the engineering to the climate.</p>
          </div>
          <div className="comparison-wrap reveal">
            <div className="model-headings">
              <span>Specification</span>
              <div><small>Essential</small><b>AXIS</b><em>from $6,890</em></div>
              <div className="featured"><small>Advanced</small><b>AXIS PRO</b><em>from $9,490</em></div>
              <div><small>Bespoke</small><b>AXIS ONE</b><em>by consultation</em></div>
            </div>
            {modelComparison.map((row) => (
              <div className="comparison-row" key={row[0]}>{row.map((cell, index) => <span key={cell} className={index === 2 ? "featured" : ""}>{cell}</span>)}</div>
            ))}
          </div>
        </section>

        <section className="process-section">
          <div className="process-copy reveal">
            <span className="section-kicker">A clear path outside</span>
            <h2>From first sketch<br />to first evening.</h2>
          </div>
          <div className="process-steps">
            <article className="reveal"><b>01</b><span>Configure</span><p>Choose the footprint, finish and performance package in the live studio.</p></article>
            <article className="reveal"><b>02</b><span>Confirm</span><p>We review access, surface conditions and local engineering requirements.</p></article>
            <article className="reveal"><b>03</b><span>Install</span><p>A labeled kit and guided assembly process bring every part into place.</p></article>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="contact-copy reveal">
            <span>THE COORDINATEZ STUDIO</span>
            <h2>Let the outside in.</h2>
            <p>Bring your dimensions. We’ll bring the possibilities.</p>
            <button onClick={addToBrief}>Start a project <b>↗</b></button>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-brand">COORDINATEZ®</div>
        <div><b>Explore</b><a href="#configure">3D configurator</a><a href="#engineering">Engineering</a><a href="#models">Model range</a></div>
        <div><b>Studio</b><a href="#contact">Book a call</a><a href="#stories">Outdoor spaces</a><a href="#top">Return to top</a></div>
        <div className="footer-note"><p>A high-fidelity demonstration experience built for a client presentation.</p><span>© 2026 Coordinatez Demo</span></div>
      </footer>

      {briefOpen && (
        <div className="brief-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setBriefOpen(false)}>
          <aside className="brief-panel" role="dialog" aria-modal="true" aria-labelledby="brief-title">
            <div className="brief-header">
              <div><span>Coordinatez project studio</span><b>{sizes[selectedSize].label} · {finishes[selectedFinish].name}</b></div>
              <button onClick={() => setBriefOpen(false)} aria-label="Close project brief">×</button>
            </div>

            {submitState === "success" ? (
              <div className="brief-success" aria-live="polite">
                <i>✓</i>
                <span>Project brief received</span>
                <h2>We have your<br />configuration.</h2>
                <p>A studio specialist can now review your Axis selections and follow up using the contact details you provided.</p>
                <div><small>Reference</small><strong>{reference}</strong></div>
                <button onClick={() => { setBriefOpen(false); setBrief(emptyBrief); }}>Return to the studio →</button>
              </div>
            ) : (
              <form className="brief-form" onSubmit={submitBrief}>
                <div className="brief-intro">
                  <span>Start your project</span>
                  <h2>Bring us<br />your outside.</h2>
                  <p>Share a few details and the complete configuration will arrive with your request.</p>
                </div>

                <div className="brief-summary">
                  <span><small>Model</small><b>AXIS</b></span>
                  <span><small>Footprint</small><b>{sizes[selectedSize].label}</b></span>
                  <span><small>Finish</small><b>{finishes[selectedFinish].name}</b></span>
                  <span><small>Estimate</small><b>{money(total)}</b></span>
                </div>

                <div className="form-grid">
                  <label><span>Name *</span><input required minLength={2} maxLength={100} autoComplete="name" value={brief.name} onChange={(event) => setBrief({ ...brief, name: event.target.value })} placeholder="Your name" /></label>
                  <label><span>Email *</span><input required type="email" maxLength={180} autoComplete="email" value={brief.email} onChange={(event) => setBrief({ ...brief, email: event.target.value })} placeholder="you@example.com" /></label>
                  <label><span>Phone</span><input type="tel" maxLength={40} autoComplete="tel" value={brief.phone} onChange={(event) => setBrief({ ...brief, phone: event.target.value })} placeholder="(555) 000-0000" /></label>
                  <label><span>Project ZIP</span><input maxLength={20} autoComplete="postal-code" value={brief.postalCode} onChange={(event) => setBrief({ ...brief, postalCode: event.target.value })} placeholder="00000" /></label>
                  <label className="full"><span>Tell us about the space</span><textarea maxLength={2500} rows={4} value={brief.notes} onChange={(event) => setBrief({ ...brief, notes: event.target.value })} placeholder="Dimensions, surface, timing, or anything we should know…" /></label>
                  <label className="form-trap" aria-hidden="true"><span>Website</span><input tabIndex={-1} autoComplete="off" value={brief.companyWebsite} onChange={(event) => setBrief({ ...brief, companyWebsite: event.target.value })} /></label>
                </div>

                <label className="brief-consent">
                  <input type="checkbox" required checked={brief.consent} onChange={(event) => setBrief({ ...brief, consent: event.target.checked })} />
                  <span />
                  <p>I agree that Coordinatez may contact me about this project request.</p>
                </label>

                {submitState === "error" && <p className="brief-error" role="alert">{submitMessage}</p>}
                <button className="brief-submit" type="submit" disabled={submitState === "sending"}>
                  <span>{submitState === "sending" ? "Sending project…" : "Send project brief"}</span><b>→</b>
                </button>
                <p className="brief-privacy">Your details are used only to respond to this project request.</p>
              </form>
            )}
          </aside>
        </div>
      )}

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status">
        <i>✓</i><div><b>Project brief received</b><span>{finishes[selectedFinish].name} · {sizes[selectedSize].label} · {money(total)}</span></div>
      </div>
    </div>
  );
}
