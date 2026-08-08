"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Vec3 = { x: number; y: number; z: number };
type Face = { points: { x: number; y: number }[]; depth: number; color: string };

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

      const sky = context.createLinearGradient(0, 0, 0, height);
      if (dusk) {
        sky.addColorStop(0, "#23272a");
        sky.addColorStop(0.52, "#595952");
        sky.addColorStop(1, "#a58d70");
      } else {
        sky.addColorStop(0, "#edf1ef");
        sky.addColorStop(0.58, "#f4f2ec");
        sky.addColorStop(1, "#d7d0c2");
      }
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      if (yardVisible) {
        context.globalAlpha = dusk ? 0.7 : 0.82;
        context.fillStyle = dusk ? "#353b39" : "#bec8c0";
        context.beginPath();
        context.moveTo(0, height * 0.53);
        context.bezierCurveTo(width * 0.18, height * 0.41, width * 0.32, height * 0.54, width * 0.5, height * 0.44);
        context.bezierCurveTo(width * 0.7, height * 0.34, width * 0.84, height * 0.5, width, height * 0.39);
        context.lineTo(width, height);
        context.lineTo(0, height);
        context.closePath();
        context.fill();
        context.fillStyle = dusk ? "#3f4541" : "#aeb9af";
        for (let i = 0; i < 9; i += 1) {
          const x = width * (0.04 + i * 0.125);
          const y = height * (0.46 + (i % 3) * 0.02);
          context.beginPath();
          context.arc(x, y, height * (0.08 + (i % 2) * 0.025), 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
      }

      const floorGradient = context.createLinearGradient(0, height * 0.58, 0, height);
      floorGradient.addColorStop(0, dusk ? "rgba(28,31,30,.1)" : "rgba(255,255,255,.05)");
      floorGradient.addColorStop(1, dusk ? "#171b1a" : "#c5b9a5");
      context.fillStyle = floorGradient;
      context.fillRect(0, height * 0.58, width, height * 0.42);

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

      addBox({ x: 0, y: 0, z: -7 }, { x: 470, y: 310, z: 12 }, dusk ? "#665b4c" : "#aa9271");

      addBox({ x: -50, y: 5, z: 23 }, { x: 126, y: 62, z: 16 }, dusk ? "#575b59" : "#a6a7a1", 0, 0.95);
      addBox({ x: -50, y: 5, z: 41 }, { x: 112, y: 52, z: 22 }, dusk ? "#686b68" : "#d5d0c5", 0, 0.95);
      addBox({ x: 88, y: 5, z: 35 }, { x: 54, y: 54, z: 31 }, dusk ? "#5f615e" : "#beb8ab", 0, 0.95);

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
    setToast(true);
    window.setTimeout(() => setToast(false), 3200);
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
              <p><i /> This is an interactive client concept. No checkout is processed.</p>
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

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status">
        <i>✓</i><div><b>Configuration saved</b><span>{finishes[selectedFinish].name} · {sizes[selectedSize].label} · {money(total)}</span></div>
      </div>
    </div>
  );
}
