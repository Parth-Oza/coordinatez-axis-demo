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
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

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

const announcementSlides = [
  {
    title: "Summer studio",
    copy: "Complimentary delivery on every Axis configuration.",
    action: "Explore the system →",
    href: "#gen-2",
  },
  {
    title: "Find your structure",
    copy: "Match the footprint, finish and climate package to your space.",
    action: "Configure now →",
    href: "#gen-2",
  },
  {
    title: "Live design review",
    copy: "Bring your dimensions to a one-to-one studio consultation.",
    action: "Start a project →",
    href: "#contact",
  },
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
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setViewerReady(true), 760);
    return () => window.clearTimeout(timer);
  }, []);

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
      if (yardVisible) {
        const parallax = (yawRef.current + 0.55) * -52 + (reducedMotion ? 0 : Math.sin(now * 0.00014) * 6);
        const horizon = height * 0.52;
        const sky = context.createLinearGradient(0, 0, 0, horizon);
        if (dusk) {
          sky.addColorStop(0, "#162536");
          sky.addColorStop(0.64, "#58606a");
          sky.addColorStop(1, "#a07a5f");
        } else {
          sky.addColorStop(0, "#ffffff");
          sky.addColorStop(0.62, "#edf2ee");
          sky.addColorStop(1, "#ccd9d1");
        }
        context.fillStyle = sky;
        context.fillRect(0, 0, width, horizon);

        context.fillStyle = dusk ? "#263438" : "#34473d";
        context.fillRect(0, height * 0.43, width, height * 0.22);
        context.fillStyle = dusk ? "#111b1e" : "#101713";
        context.fillRect(0, height * 0.61, width, height * 0.018);
        context.fillStyle = dusk ? "#68706f" : "#d6dad6";
        context.fillRect(0, height * 0.629, width, height * 0.035);

        const houseX = width * 0.71 + parallax * 0.36;
        context.fillStyle = dusk ? "#202b2d" : "#262e2d";
        context.fillRect(houseX - width * 0.08, height * 0.34, width * 0.36, height * 0.035);
        context.fillStyle = dusk ? "#696258" : "#a28e72";
        context.fillRect(houseX, height * 0.375, width * 0.29, height * 0.25);
        context.strokeStyle = dusk ? "rgba(255,210,144,.13)" : "rgba(62,49,36,.18)";
        context.lineWidth = 1;
        for (let x = houseX + 5; x < houseX + width * 0.29; x += 9) {
          context.beginPath();
          context.moveTo(x, height * 0.375);
          context.lineTo(x, height * 0.625);
          context.stroke();
        }
        context.fillStyle = dusk ? "#131d21" : "#555a57";
        context.fillRect(houseX + width * 0.12, height * 0.405, width * 0.11, height * 0.22);
        if (dusk) {
          const windowGlow = context.createLinearGradient(0, height * 0.405, 0, height * 0.625);
          windowGlow.addColorStop(0, "rgba(255,218,158,.78)");
          windowGlow.addColorStop(1, "rgba(170,106,52,.35)");
          context.fillStyle = windowGlow;
          context.fillRect(houseX + width * 0.125, height * 0.412, width * 0.1, height * 0.2);
        }

        const drawTree = (x: number, y: number, scale: number) => {
          context.save();
          context.translate(x + parallax * scale * 0.2, y);
          context.strokeStyle = dusk ? "rgba(15,25,25,.88)" : "rgba(18,38,29,.86)";
          context.fillStyle = dusk ? "rgba(23,39,35,.82)" : "rgba(39,70,54,.78)";
          context.lineWidth = Math.max(1, scale * 2.2);
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(0, -66 * scale);
          context.moveTo(0, -39 * scale);
          context.lineTo(-28 * scale, -71 * scale);
          context.moveTo(0, -50 * scale);
          context.lineTo(31 * scale, -86 * scale);
          context.stroke();
          for (const [cx, cy, radius] of [[-25, -70, 23], [4, -87, 28], [31, -69, 22], [1, -57, 27]] as const) {
            context.beginPath();
            context.arc(cx * scale, cy * scale, radius * scale, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();
        };
        drawTree(width * 0.08, height * 0.56, 0.72);
        drawTree(width * 0.61, height * 0.56, 1.08);
        drawTree(width * 0.93, height * 0.58, 0.82);

        const deck = context.createLinearGradient(0, horizon, 0, height);
        deck.addColorStop(0, dusk ? "#594d42" : "#c7aa85");
        deck.addColorStop(1, dusk ? "#2e2925" : "#876247");
        context.fillStyle = deck;
        context.fillRect(0, horizon, width, height - horizon);
        const lightSweep = context.createLinearGradient(width * 0.05 + parallax, horizon, width * 0.76 + parallax, height);
        lightSweep.addColorStop(0, "rgba(255,255,255,0)");
        lightSweep.addColorStop(0.5, dusk ? "rgba(255,177,82,.12)" : "rgba(255,246,215,.3)");
        lightSweep.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = lightSweep;
        context.fillRect(0, horizon, width, height - horizon);

        const contrastGlow = context.createRadialGradient(width * 0.56, height * 0.44, 12, width * 0.56, height * 0.44, width * 0.42);
        contrastGlow.addColorStop(0, dusk ? "rgba(242,172,94,.13)" : "rgba(201,255,97,.2)");
        contrastGlow.addColorStop(1, "rgba(201,255,97,0)");
        context.fillStyle = contrastGlow;
        context.fillRect(0, 0, width, height);
      } else {
        const studio = context.createLinearGradient(0, 0, 0, height);
        studio.addColorStop(0, dusk ? "#242a2a" : "#ffffff");
        studio.addColorStop(0.72, dusk ? "#343a38" : "#f7f7f4");
        studio.addColorStop(1, dusk ? "#171b1a" : "#e9e7e1");
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
      const scaleBase = Math.min(width / 560, height / 430) * 0.78;

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

      context.save();
      context.beginPath();
      context.rect(0, height * .52, width, height * .48);
      context.clip();
      context.strokeStyle = dusk ? "rgba(255,255,255,.08)" : "rgba(53,34,22,.34)";
      context.lineWidth = .75;
      for (let boardY = -260; boardY <= 260; boardY += 14) {
        const start = project({ x: -440, y: boardY, z: .3 });
        const end = project({ x: 440, y: boardY, z: .3 });
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }
      context.strokeStyle = dusk ? "rgba(255,255,255,.045)" : "rgba(255,241,220,.2)";
      for (let seamX = -400; seamX <= 400; seamX += 80) {
        const start = project({ x: seamX, y: -280, z: .35 });
        const end = project({ x: seamX, y: 280, z: .35 });
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }
      context.restore();

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
              const x = (size.x / 2) * xSign;
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
      const postAnchors = [-186, 186].flatMap((x) => [-103, 103].map((y) => ({ x, y })));
      for (const { x, y } of postAnchors) {
        addBox({ x, y, z: 3 }, { x: 34, y: 34, z: 6 }, shade(finish, -8));
        addBox({ x, y, z: 8 }, { x: 24, y: 24, z: 10 }, shade(finish, 4));
        addBox({ x, y, z: postZ }, { x: 18, y: 18, z: 220 }, finish);
        for (const boltX of [-11, 11]) {
          for (const boltY of [-11, 11]) {
            addBox({ x: x + boltX, y: y + boltY, z: 6.6 }, { x: 3.4, y: 3.4, z: 1.2 }, dusk ? "#060908" : "#111713");
          }
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

      const brandMark = project({ x: 112, y: -116, z: 226 });
      context.save();
      context.translate(brandMark.x, brandMark.y);
      context.fillStyle = dusk ? "rgba(241,244,241,.9)" : "rgba(239,242,238,.92)";
      context.fillRect(-37, -8, 74, 16);
      context.fillStyle = "#18201c";
      context.font = "700 7px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("COORDINATEZ", 0, 0);
      context.restore();

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
    pitchRef.current = Math.max(0.36, Math.min(0.94, pitchRef.current + dy * 0.004));
    lastRef.current = { x: event.clientX, y: event.clientY };
  };

  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="viewer-shell">
      <div className={`viewer-loader ${viewerReady ? "is-ready" : ""}`} aria-hidden="true">
        <span>COORDINATEZ</span><i />
      </div>
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

function RealPergolaViewer({
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
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const liveStateRef = useRef({ finish, louversOpen, yardVisible, dusk });
  const [viewerReady, setViewerReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    liveStateRef.current = { finish, louversOpen, yardVisible, dusk };
  }, [dusk, finish, louversOpen, yardVisible]);

  const resetView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(10.5, 4.55, 12.8);
    controls.target.set(0, 2.18, 0);
    controls.autoRotate = true;
    controls.update();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setWebglFailed(true));
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#dfe8e1", 16, 38);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);
    camera.position.set(10.5, 4.55, 12.8);
    cameraRef.current = camera;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const physicalEnvironment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = physicalEnvironment;
    scene.environmentIntensity = 0.85;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 10.5;
    controls.maxDistance = 23;
    controls.minPolarAngle = 0.42;
    controls.maxPolarAngle = 1.43;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.72;
    controls.target.set(0, 2.18, 0);
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.32;
    const stopAutoRotate = () => { controls.autoRotate = false; };
    controls.addEventListener("start", stopAutoRotate);
    controlsRef.current = controls;

    const makeSky = (colors: [string, string, string]) => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = 32;
      textureCanvas.height = 512;
      const textureContext = textureCanvas.getContext("2d");
      if (textureContext) {
        const gradient = textureContext.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(0.58, colors[1]);
        gradient.addColorStop(1, colors[2]);
        textureContext.fillStyle = gradient;
        textureContext.fillRect(0, 0, 32, 512);
      }
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const daySky = makeSky(["#fdfefa", "#dce8e1", "#91aa9b"]);
    const duskSky = makeSky(["#101c2c", "#485468", "#d49461"]);
    const studioSky = makeSky(["#ffffff", "#f0f2ed", "#cbd2cc"]);
    scene.background = daySky;
    const patioTexture = new THREE.TextureLoader().load("/coordinatez-patio-environment.jpg");
    patioTexture.colorSpace = THREE.SRGBColorSpace;
    patioTexture.wrapS = THREE.ClampToEdgeWrapping;
    patioTexture.wrapT = THREE.ClampToEdgeWrapping;
    patioTexture.repeat.set(1, 0.88);
    patioTexture.updateMatrix();

    const woodCanvas = document.createElement("canvas");
    woodCanvas.width = 1024;
    woodCanvas.height = 1024;
    const woodContext = woodCanvas.getContext("2d");
    if (woodContext) {
      const base = woodContext.createLinearGradient(0, 0, 1024, 1024);
      base.addColorStop(0, "#c6a37a");
      base.addColorStop(0.5, "#9d7653");
      base.addColorStop(1, "#b58b61");
      woodContext.fillStyle = base;
      woodContext.fillRect(0, 0, 1024, 1024);
      for (let x = 0; x <= 1024; x += 128) {
        woodContext.strokeStyle = "rgba(48,27,15,.46)";
        woodContext.lineWidth = 5;
        woodContext.beginPath();
        woodContext.moveTo(x, 0);
        woodContext.lineTo(x, 1024);
        woodContext.stroke();
        woodContext.strokeStyle = "rgba(255,236,207,.2)";
        woodContext.lineWidth = 2;
        woodContext.beginPath();
        woodContext.moveTo(x + 6, 0);
        woodContext.lineTo(x + 6, 1024);
        woodContext.stroke();
      }
      for (let index = 0; index < 75; index += 1) {
        const y = index * 13.7;
        woodContext.strokeStyle = `rgba(60,34,19,${0.035 + (index % 4) * 0.012})`;
        woodContext.lineWidth = 1.2;
        woodContext.beginPath();
        woodContext.moveTo(0, y);
        for (let x = 0; x <= 1024; x += 64) {
          woodContext.lineTo(x, y + Math.sin(x * 0.022 + index) * 4.5);
        }
        woodContext.stroke();
      }
    }
    const woodTexture = new THREE.CanvasTexture(woodCanvas);
    woodTexture.colorSpace = THREE.SRGBColorSpace;
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(6, 4.5);
    woodTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const aluminum = new THREE.MeshPhysicalMaterial({
      color: liveStateRef.current.finish,
      metalness: 0.68,
      roughness: 0.3,
      clearcoat: 0.28,
      clearcoatRoughness: 0.34,
    });
    const louverMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(liveStateRef.current.finish).offsetHSL(0, 0, -0.025),
      metalness: 0.64,
      roughness: 0.34,
      clearcoat: 0.16,
    });
    const channelMaterial = new THREE.MeshStandardMaterial({ color: "#101714", metalness: 0.72, roughness: 0.34 });
    const boltMaterial = new THREE.MeshStandardMaterial({ color: "#0b0f0d", metalness: 0.92, roughness: 0.2 });
    const deckMaterial = new THREE.MeshStandardMaterial({ map: woodTexture, color: "#ffffff", roughness: 0.72, metalness: 0.03 });
    const patioShadowMaterial = new THREE.ShadowMaterial({ color: "#142219", opacity: 0.2, transparent: true });
    const grassMaterial = new THREE.MeshStandardMaterial({ color: "#314f3b", roughness: 1 });
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#d8d3c8", roughness: 0.92 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: "#29332f", roughness: 0.74 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: "#9fb5ae",
      metalness: 0.05,
      roughness: 0.13,
      transmission: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    const warmMaterial = new THREE.MeshStandardMaterial({ color: "#d6a978", emissive: "#f0a65d", emissiveIntensity: 0.34, roughness: 0.7 });
    const ledMaterial = new THREE.MeshStandardMaterial({ color: "#f2ead8", emissive: "#ffd59a", emissiveIntensity: 0.08, roughness: 0.3 });
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const glowContext = glowCanvas.getContext("2d");
    if (glowContext) {
      const glow = glowContext.createRadialGradient(128, 128, 8, 128, 128, 124);
      glow.addColorStop(0, "rgba(255,222,164,.95)");
      glow.addColorStop(0.38, "rgba(255,197,111,.44)");
      glow.addColorStop(1, "rgba(255,183,88,0)");
      glowContext.fillStyle = glow;
      glowContext.fillRect(0, 0, 256, 256);
    }
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    const glowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: "#ffd39a",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const addBox = (
      parent: THREE.Object3D,
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
      castShadow = true,
      receiveShadow = false,
    ) => {
      const radius = Math.min(0.045, Math.min(...size) * 0.12);
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius), material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    };

    const deck = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), patioShadowMaterial);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = -0.012;
    deck.receiveShadow = true;
    scene.add(deck);

    const environment = new THREE.Group();
    scene.add(environment);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(38, 32), grassMaterial);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, -0.09, -5);
    lawn.receiveShadow = true;
    environment.add(lawn);
    addBox(environment, [12, 3.8, 0.42], [1.8, 1.86, -6.6], wallMaterial, false, true);
    addBox(environment, [4.5, 0.34, 1.2], [1.7, 3.88, -6.25], channelMaterial, true, true);
    addBox(environment, [4.35, 2.72, 0.08], [0.8, 1.48, -6.36], glassMaterial, false, false);
    addBox(environment, [2.55, 2.72, 0.06], [4.35, 1.48, -6.35], warmMaterial, false, false);
    addBox(environment, [3.1, 0.16, 0.55], [-3.6, 0.08, -5.1], stoneMaterial, false, true);

    const foliageMaterial = new THREE.MeshStandardMaterial({ color: "#244734", roughness: 0.98 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#594a39", roughness: 1 });
    const addTree = (x: number, z: number, scale: number) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.13 * scale, 1.4 * scale, 9), trunkMaterial);
      trunk.position.y = 0.7 * scale;
      trunk.castShadow = true;
      tree.add(trunk);
      for (const [offsetX, offsetY, offsetZ, radius] of [
        [0, 1.55, 0, 0.65], [-0.42, 1.42, 0.08, 0.46], [0.42, 1.48, -0.08, 0.52], [0.05, 1.95, 0.05, 0.5],
      ] as const) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * scale, 1), foliageMaterial);
        crown.position.set(offsetX * scale, offsetY * scale, offsetZ * scale);
        crown.castShadow = true;
        tree.add(crown);
      }
      tree.position.set(x, 0, z);
      environment.add(tree);
    };
    addTree(-6.4, -4.9, 1.15);
    addTree(7.5, -5.4, 1.3);
    addTree(-7.4, 1.2, 0.9);

    const pergola = new THREE.Group();
    pergola.position.y = 0.015;
    scene.add(pergola);
    const postAnchors: Array<[number, number]> = [[-3, -2.05], [-3, 2.05], [3, -2.05], [3, 2.05]];
    const boltGeometry = new THREE.CylinderGeometry(0.037, 0.037, 0.034, 18);
    const washerGeometry = new THREE.CylinderGeometry(0.062, 0.062, 0.016, 20);
    for (const [x, z] of postAnchors) {
      addBox(pergola, [0.52, 0.09, 0.52], [x, 0.045, z], channelMaterial, true, true);
      addBox(pergola, [0.34, 0.15, 0.34], [x, 0.14, z], aluminum, true, true);
      addBox(pergola, [0.245, 3.08, 0.245], [x, 1.69, z], aluminum, true, true);
      for (const boltX of [-0.17, 0.17]) {
        for (const boltZ of [-0.17, 0.17]) {
          const washer = new THREE.Mesh(washerGeometry, boltMaterial);
          washer.position.set(x + boltX, 0.101, z + boltZ);
          washer.castShadow = true;
          pergola.add(washer);
          const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
          bolt.position.set(x + boltX, 0.125, z + boltZ);
          bolt.castShadow = true;
          pergola.add(bolt);
        }
      }
    }

    addBox(pergola, [6.48, 0.34, 0.32], [0, 3.18, -2.08], aluminum);
    addBox(pergola, [6.48, 0.34, 0.32], [0, 3.18, 2.08], aluminum);
    addBox(pergola, [0.32, 0.34, 4.48], [-3.08, 3.18, 0], aluminum);
    addBox(pergola, [0.32, 0.34, 4.48], [3.08, 3.18, 0], aluminum);
    addBox(pergola, [6.08, 0.11, 0.12], [0, 3.01, -1.94], channelMaterial);
    addBox(pergola, [6.08, 0.11, 0.12], [0, 3.01, 1.94], channelMaterial);
    addBox(pergola, [0.16, 0.17, 3.88], [-2.89, 3.04, 0], channelMaterial);
    addBox(pergola, [0.16, 0.17, 3.88], [2.89, 3.04, 0], channelMaterial);
    addBox(pergola, [0.37, 0.38, 0.92], [3.15, 3.13, -1.42], channelMaterial);
    for (const [x, z] of [[-2.82, -1.82], [-2.82, 1.82], [2.82, -1.82], [2.82, 1.82]] as const) {
      addBox(pergola, [0.34, 0.22, 0.34], [x, 2.95, z], channelMaterial, true, true);
    }

    const louverMeshes: THREE.Mesh[] = [];
    const louverGeometry = new RoundedBoxGeometry(5.82, 0.055, 0.235, 2, 0.018);
    for (let index = 0; index < 18; index += 1) {
      const blade = new THREE.Mesh(louverGeometry, louverMaterial);
      blade.position.set(0, 3.17, -1.785 + index * 0.21);
      blade.castShadow = true;
      blade.receiveShadow = true;
      pergola.add(blade);
      louverMeshes.push(blade);
    }

    const frontLed = addBox(pergola, [5.85, 0.024, 0.035], [0, 2.98, 1.91], ledMaterial, false, false);
    const rearLed = addBox(pergola, [5.85, 0.024, 0.035], [0, 2.98, -1.91], ledMaterial, false, false);
    const leftLed = addBox(pergola, [0.035, 0.024, 3.62], [-2.86, 2.98, 0], ledMaterial, false, false);
    const rightLed = addBox(pergola, [0.035, 0.024, 3.62], [2.86, 2.98, 0], ledMaterial, false, false);
    frontLed.renderOrder = 2;
    rearLed.renderOrder = 2;
    leftLed.renderOrder = 2;
    rightLed.renderOrder = 2;

    for (const x of [-1.8, 1.8]) {
      const glowPool = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 4.2), glowMaterial);
      glowPool.rotation.x = -Math.PI / 2;
      glowPool.position.set(x, 0.006, 0);
      glowPool.renderOrder = 3;
      scene.add(glowPool);
    }

    const brandCanvas = document.createElement("canvas");
    brandCanvas.width = 768;
    brandCanvas.height = 160;
    const brandContext = brandCanvas.getContext("2d");
    if (brandContext) {
      brandContext.fillStyle = "#f4f4ef";
      brandContext.fillRect(0, 0, 768, 160);
      brandContext.fillStyle = "#121a16";
      brandContext.font = "700 68px Arial, sans-serif";
      brandContext.textAlign = "center";
      brandContext.textBaseline = "middle";
      brandContext.fillText("COORDINATEZ", 384, 82);
    }
    const brandTexture = new THREE.CanvasTexture(brandCanvas);
    brandTexture.colorSpace = THREE.SRGBColorSpace;
    const brandPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.19), new THREE.MeshBasicMaterial({ map: brandTexture, toneMapped: false }));
    brandPlate.position.set(0.68, 3.18, 2.245);
    pergola.add(brandPlate);

    const hemisphere = new THREE.HemisphereLight("#f7fbf7", "#314437", 2.2);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight("#fff5df", 3.2);
    sun.position.set(7, 11, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 32;
    sun.shadow.bias = -0.00025;
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#c9ff61", 0.85);
    rim.position.set(-8, 4, -6);
    scene.add(rim);
    const warmLight = new THREE.PointLight("#ffbc73", 0, 14, 1.8);
    warmLight.position.set(3.9, 2.25, -4.9);
    scene.add(warmLight);
    const pergolaLights = [[-1.9, 2.72, 0], [1.9, 2.72, 0]].map(([x, y, z]) => {
      const light = new THREE.PointLight("#ffd79a", 0, 6, 2);
      light.position.set(x, y, z);
      scene.add(light);
      return light;
    });

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let animationFrame = 0;
    let hasRendered = false;
    let previousFrame = performance.now();
    const render = (now = performance.now()) => {
      const delta = Math.min((now - previousFrame) / 1000, 0.05);
      previousFrame = now;
      const state = liveStateRef.current;
      const targetColor = new THREE.Color(state.finish);
      aluminum.color.lerp(targetColor, 0.09);
      louverMaterial.color.lerp(targetColor.clone().offsetHSL(0, 0, -0.025), 0.09);
      const bladeTarget = state.louversOpen ? -Math.PI * 0.46 : 0;
      for (let index = 0; index < louverMeshes.length; index += 1) {
        const blade = louverMeshes[index];
        const response = Math.min(1, delta * (5.2 + index * 0.035));
        blade.rotation.x = THREE.MathUtils.lerp(blade.rotation.x, bladeTarget, response);
      }

      const duskMix = state.dusk ? 1 : 0;
      scene.background = state.yardVisible ? (patioTexture.image ? patioTexture : (state.dusk ? duskSky : daySky)) : studioSky;
      scene.backgroundIntensity = THREE.MathUtils.lerp(scene.backgroundIntensity, state.dusk ? 0.56 : 1, 0.06);
      environment.visible = false;
      deck.material = state.yardVisible ? patioShadowMaterial : deckMaterial;
      if (scene.fog) scene.fog.color.lerp(new THREE.Color(state.dusk ? "#23303a" : "#dfe8e1"), 0.08);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, state.dusk ? 0.88 : 1.18, 0.06);
      hemisphere.intensity = THREE.MathUtils.lerp(hemisphere.intensity, state.dusk ? 0.92 : 2.7, 0.07);
      sun.intensity = THREE.MathUtils.lerp(sun.intensity, state.dusk ? 0.72 : 2.65, 0.07);
      rim.intensity = THREE.MathUtils.lerp(rim.intensity, state.dusk ? 0.42 : 0.85, 0.07);
      warmLight.intensity = THREE.MathUtils.lerp(warmLight.intensity, state.dusk ? 18 : 0, 0.07);
      ledMaterial.emissiveIntensity = THREE.MathUtils.lerp(ledMaterial.emissiveIntensity, state.dusk ? 5.5 : 0.08, 0.1);
      glowMaterial.opacity = THREE.MathUtils.lerp(glowMaterial.opacity, state.dusk ? 0.48 : 0, 0.09);
      for (const light of pergolaLights) light.intensity = THREE.MathUtils.lerp(light.intensity, duskMix * 13, 0.09);

      controls.update(delta);
      renderer.render(scene, camera);
      if (!hasRendered) {
        hasRendered = true;
        window.setTimeout(() => setViewerReady(true), 260);
      }
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();
      cameraRef.current = null;
      controlsRef.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
      woodTexture.dispose();
      glowTexture.dispose();
      daySky.dispose();
      duskSky.dispose();
      studioSky.dispose();
      patioTexture.dispose();
      brandTexture.dispose();
      physicalEnvironment.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return <PergolaViewer finish={finish} louversOpen={louversOpen} yardVisible={yardVisible} dusk={dusk} />;
  }

  return (
    <div className="viewer-shell viewer-shell-real">
      <div className={`viewer-loader ${viewerReady ? "is-ready" : ""}`} aria-hidden="true">
        <span>COORDINATEZ / PHYSICAL VIEW</span><i />
      </div>
      <div className="viewer-topline">
        <span><i /> Real-time 3D model</span>
        <button onClick={resetView} aria-label="Reset 3D view">Reset view ↗</button>
      </div>
      <canvas
        ref={canvasRef}
        className="product-canvas"
        aria-label="Interactive three-dimensional model of the Coordinatez Axis pergola. Drag to orbit and scroll to zoom."
      />
      <div className="viewer-badge">WebGL physical materials</div>
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

export function ProductStudio() {
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
  const [announcementIndex, setAnnouncementIndex] = useState(0);
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

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setAnnouncementIndex((current) => (current + 1) % announcementSlides.length),
      4800,
    );
    return () => window.clearInterval(timer);
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
        <div className="announcement-copy" key={announcementIndex}>
          <span>{announcementSlides[announcementIndex].title}</span>
          <p>{announcementSlides[announcementIndex].copy}</p>
          <a href={announcementSlides[announcementIndex].href}>{announcementSlides[announcementIndex].action}</a>
        </div>
        <div className="announcement-art" aria-hidden="true"><i /><i /><i /><span>AXIS</span></div>
        <div className="announcement-progress" aria-hidden="true" />
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
            <RealPergolaViewer
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
        <div className="brief-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBriefOpen(false)}>
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

type RangeModel = {
  tag: string;
  name: string;
  wind: string;
  span: string;
  snow: string;
  price: string;
  basePrice: number;
  description: string;
  imagePosition: string;
  tone: "day" | "night" | "sand" | "legacy";
};

const modelRanges: { title: string; id: string; models: RangeModel[] }[] = [
  {
    title: "Gen 2 Motorized Pergola",
    id: "gen-2",
    models: [
      {
        tag: "Standard",
        name: "AXIS Motorized Pergola",
        wind: "80 MPH",
        span: "Extended sizes",
        snow: "20 PSF",
        price: "From $6,890–$13,490",
        basePrice: 6890,
        description: "Balanced performance for most residential climates",
        imagePosition: "0% 50%",
        tone: "day",
      },
      {
        tag: "Advanced",
        name: "AXIS PRO Motorized Pergola",
        wind: "135 MPH",
        span: "Extended sizes",
        snow: "40 PSF",
        price: "From $9,490–$18,990",
        basePrice: 9490,
        description: "Reinforced for demanding year-round weather",
        imagePosition: "50% 50%",
        tone: "night",
      },
      {
        tag: "Custom and premium",
        name: "AXIS ONE Custom Pergola",
        wind: "160 MPH",
        span: "Made to measure",
        snow: "50 PSF",
        price: "From $12,900",
        basePrice: 12900,
        description: "A site-specific system shaped around your architecture",
        imagePosition: "100% 50%",
        tone: "sand",
      },
    ],
  },
  {
    title: "Gen 1 Motorized Pergola",
    id: "gen-1",
    models: [
      {
        tag: "Original",
        name: "AXIS CLASSIC Motorized Pergola",
        wind: "90 MPH",
        span: "Standard sizes",
        snow: "25 PSF",
        price: "From $5,490–$9,890",
        basePrice: 5490,
        description: "The proven original for composed outdoor living",
        imagePosition: "0% 50%",
        tone: "legacy",
      },
    ],
  },
];

const allModels = modelRanges.flatMap((range) => range.models);

function MetricIcon({ type }: { type: "wind" | "span" | "snow" }) {
  return <i className={`metric-icon metric-${type}`} aria-hidden="true"><span /></i>;
}

function RangeCard({
  model,
  index,
  initial = false,
  onOpen,
}: {
  model: RangeModel;
  index: number;
  initial?: boolean;
  onOpen: (model: RangeModel) => void;
}) {
  return (
    <article className={`range-card range-reveal${initial ? " is-visible" : ""}`} style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}>
      <div
        className={`range-card-cover is-${model.tone}`}
        style={{ backgroundPosition: model.imagePosition }}
        role="img"
        aria-label={`${model.name} installed in an architectural outdoor setting`}
      >
        <span className="range-image-label">COORDINATEZ / {model.tag}</span>
      </div>
      <div className="range-card-content">
        <div className="range-card-inner">
          <span className="range-tag">{model.tag}</span>
          <h2>{model.name}</h2>
          <div className="range-swatches" aria-label="Available finishes">
            <i className="swatch-carbon" /><i className="swatch-cloud" /><i className="swatch-sand" />
          </div>
          <div className="range-metrics">
            <span><MetricIcon type="wind" /><b>{model.wind}</b></span>
            <span><MetricIcon type="span" /><b>{model.span}</b></span>
            <span><MetricIcon type="snow" /><b>{model.snow}</b></span>
          </div>
          <strong className="range-price">{model.price}</strong>
          <p>{model.description}</p>
        </div>
        <button className="range-view-button" onClick={() => onOpen(model)}>View model</button>
      </div>
    </article>
  );
}

export default function Home() {
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState<RangeModel>(modelRanges[0].models[0]);
  const [studioOpen, setStudioOpen] = useState(false);
  const [louversOpen, setLouversOpen] = useState(false);
  const [yardVisible, setYardVisible] = useState(true);
  const [dusk, setDusk] = useState(false);
  const [selectedFinish, setSelectedFinish] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState<BriefForm>(emptyBrief);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [reference, setReference] = useState("");
  const [toast, setToast] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroScene, setHeroScene] = useState(0);
  const [trayCount, setTrayCount] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [newsletterMessage, setNewsletterMessage] = useState("");

  const sizePremiums = [0, 900, 2400, 6600];
  const total = selectedModel.basePrice + sizePremiums[selectedSize];
  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allModels;
    return allModels.filter((model) => [model.name, model.tag, model.wind, model.span, model.snow, model.description].some((value) => value.toLowerCase().includes(query)));
  }, [searchQuery]);

  useEffect(() => {
    const studio = new URLSearchParams(window.location.search).get("studio");
    if (!studio) return;
    const frame = window.requestAnimationFrame(() => {
      if (studio === "pro") setSelectedModel(modelRanges[0].models[1]);
      setStudioOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setAnnouncementIndex((current) => (current + 1) % announcementSlides.length),
      4800,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".range-reveal").forEach((element) => reveal.observe(element));
    return () => reveal.disconnect();
  }, []);

  useEffect(() => {
    if (!studioOpen && !briefOpen && !searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (briefOpen) setBriefOpen(false);
      else setStudioOpen(false);
      if (searchOpen) setSearchOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [briefOpen, searchOpen, studioOpen]);

  const openModel = (model: RangeModel) => {
    setSelectedModel(model);
    setLouversOpen(false);
    setDusk(false);
    setStudioOpen(true);
  };

  const openBrief = () => {
    setSubmitState("idle");
    setSubmitMessage("");
    setBriefOpen(true);
  };

  const addModelToBrief = () => {
    setTrayCount(1);
    openBrief();
  };

  const moveHeroLight = (event: ReactPointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };

  const submitNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewsletterState("sending");
    setNewsletterMessage("");
    const apiBase = typeof __BRIEF_API_URL_B64__ === "string" ? window.atob(__BRIEF_API_URL_B64__).replace(/\/$/, "") : "";

    try {
      const response = await fetch(`${apiBase}/api/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail, companyWebsite: "" }),
      });
      const result = (await response.json()) as { error?: string; alreadySubscribed?: boolean };
      if (!response.ok) throw new Error(result.error || "We could not save your email.");
      setNewsletterState("success");
      setNewsletterMessage(result.alreadySubscribed ? "You’re already on the list." : "You’re on the list. Watch your inbox.");
      setNewsletterEmail("");
    } catch (error) {
      setNewsletterState("error");
      setNewsletterMessage(error instanceof Error ? error.message : "We could not save your email.");
    }
  };

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
            product: selectedModel.name,
            finish: finishes[selectedFinish].name,
            size: sizes[selectedSize].label,
            price: total,
            louversOpen,
            eveningLight: dusk,
            heaters: false,
            privacyScreen: false,
          },
        }),
      });
      const result = (await response.json()) as { error?: string; reference?: string };
      if (!response.ok) throw new Error(result.error || "We could not send your project brief.");
      setReference(result.reference ?? "RECEIVED");
      setSubmitState("success");
      setTrayCount(0);
      setToast(true);
      window.setTimeout(() => setToast(false), 3600);
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "We could not send your project brief.");
      setSubmitState("error");
    }
  };

  return (
    <div className="compare-site">
      <div className="scroll-line" aria-hidden="true" />
      <div className="announcement">
        <div className="announcement-copy" key={announcementIndex}>
          <span>{announcementSlides[announcementIndex].title}</span>
          <p>{announcementSlides[announcementIndex].copy}</p>
          <a href={announcementSlides[announcementIndex].href}>{announcementSlides[announcementIndex].action}</a>
        </div>
        <div className="announcement-art" aria-hidden="true"><i /><i /><i /><span>AXIS</span></div>
        <div className="announcement-progress" aria-hidden="true" />
      </div>

      <header className="site-header compare-header">
        <a className="brand" href="#top" aria-label="Coordinatez home">COORDINATEZ<span>®</span></a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Main navigation">
          <a href="#gen-2" onClick={() => setMenuOpen(false)}>Models</a>
          <a href="#gen-1" onClick={() => setMenuOpen(false)}>Original</a>
          <button onClick={() => { openModel(modelRanges[0].models[0]); setMenuOpen(false); }}>3D Studio</button>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact us</a>
        </nav>
        <div className="header-actions">
          <button className="search-glyph" aria-label="Search models" onClick={() => setSearchOpen(true)}>⌕</button>
          <button className={`round-button ${trayCount ? "has-item" : ""}`} aria-label={`Open project brief, ${trayCount} selected model${trayCount === 1 ? "" : "s"}`} onClick={openBrief}>{trayCount}</button>
          <button className="menu-button" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
        </div>
      </header>

      <main className="compare-main" id="top">
        <section className={`compare-hero hero-scene-${heroScene}`} onPointerMove={moveHeroLight}>
          <div className="hero-ambient" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <div className="hero-scenes" aria-label="Explore project environments">
            {["Desert", "Woodland", "Coast"].map((scene, index) => (
              <button
                className={heroScene === index ? "is-active" : ""}
                key={scene}
                onClick={() => setHeroScene(index)}
                aria-pressed={heroScene === index}
              >
                <small>0{index + 1}</small>{scene}
              </button>
            ))}
          </div>
          <div className="hero-copy">
            <div className="hero-status"><i /> Interactive model range · Four systems online</div>
            <h1>Shape the light.<br /><em>Own the outside.</em></h1>
            <p>Explore every Coordinatez pergola against a living architectural backdrop, then configure the structure in real time.</p>
            <div className="hero-actions">
              <button onClick={() => document.getElementById("gen-2")?.scrollIntoView({ behavior: "smooth" })}>Explore models <b>↓</b></button>
              <button onClick={() => openModel(modelRanges[0].models[1])}>Launch 3D studio <b>↗</b></button>
            </div>
          </div>
          <div className="hero-data" aria-label="System range summary">
            <span><small>Range</small><b>04 systems</b></span>
            <span><small>Wind engineering</small><b>Up to 160 MPH</b></span>
            <span><small>Control</small><b>Motorized louvers</b></span>
          </div>
          <div className="hero-scroll" aria-hidden="true"><span>Scroll to compare</span><i /></div>
        </section>

        {modelRanges.map((range) => (
          <section className="model-range" id={range.id} key={range.id}>
            <div className={`range-heading range-reveal ${range.id === "gen-2" ? "is-visible" : ""}`}>
              <h2>{range.title}</h2>
              <span>{String(range.models.length).padStart(2, "0")} models</span>
            </div>
            <div className="range-scroll">
              <div className={`range-list ${range.models.length === 1 ? "is-single" : ""}`}>
                {range.models.map((model, index) => <RangeCard key={model.name} model={model} index={index} initial={range.id === "gen-2"} onOpen={openModel} />)}
              </div>
            </div>
          </section>
        ))}

        <section className="compare-help" id="contact">
          <div className="compare-help-copy range-reveal">
            <span>Still deciding?</span>
            <h2>Bring us the site.<br />We’ll find the system.</h2>
            <p>Share your climate, footprint and architectural intent. The Coordinatez studio will recommend the right structure.</p>
            <button onClick={openBrief}>Start a project <b>→</b></button>
          </div>
          <div className="compare-help-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </section>

        <section className="compare-newsletter">
          <div><span>Coordinatez field notes</span><h2>Ideas for living outside.</h2></div>
          <form onSubmit={submitNewsletter}>
            <label htmlFor="updates-email">Email address</label>
            <input id="updates-email" required type="email" maxLength={180} autoComplete="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="you@example.com" />
            <button type="submit" disabled={newsletterState === "sending"}>{newsletterState === "sending" ? "Joining…" : "Subscribe →"}</button>
            <p className={`newsletter-status is-${newsletterState}`} aria-live="polite">{newsletterMessage}</p>
          </form>
        </section>
      </main>

      <footer className="compare-footer">
        <div className="footer-brand">COORDINATEZ®</div>
        <div><b>Products</b><a href="#gen-2">Gen 2 range</a><a href="#gen-1">Gen 1 original</a><button onClick={() => openModel(modelRanges[0].models[0])}>3D studio</button></div>
        <div><b>Studio</b><button onClick={openBrief}>Project brief</button><a href="#contact">Contact</a><a href="#top">Return to top</a></div>
        <div className="footer-note"><p>Precision outdoor systems shaped for light, weather and long days outside.</p><span>© 2026 Coordinatez Demo</span></div>
      </footer>

      {searchOpen && (
        <div className="model-search-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}>
          <section className="model-search-dialog" role="dialog" aria-modal="true" aria-labelledby="model-search-title">
            <div className="model-search-head"><div><span>Coordinatez model finder</span><h2 id="model-search-title">Find your system.</h2></div><button onClick={() => setSearchOpen(false)} aria-label="Close model search">×</button></div>
            <label className="model-search-field"><span>Search by model, climate or performance</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Try “high wind”, “custom”, or “snow”…" /><i>⌕</i></label>
            <div className="model-search-results" aria-live="polite">
              {filteredModels.map((model) => (
                <button key={model.name} onClick={() => { setSearchOpen(false); openModel(model); }}>
                  <i className={`search-model-image is-${model.tone}`} style={{ backgroundPosition: model.imagePosition }} />
                  <span><small>{model.tag}</small><b>{model.name}</b><em>{model.wind} · {model.snow}</em></span><strong>Explore ↗</strong>
                </button>
              ))}
              {filteredModels.length === 0 && <p>No model matches that search. Try a rating, finish or model name.</p>}
            </div>
          </section>
        </div>
      )}

      {studioOpen && (
        <div className="model-studio-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setStudioOpen(false)}>
          <section className="model-studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-model-title">
            <button className="studio-close" onClick={() => setStudioOpen(false)} aria-label="Close 3D studio">×</button>
            <div className="studio-visual">
              <RealPergolaViewer finish={finishes[selectedFinish].value} louversOpen={louversOpen} yardVisible={yardVisible} dusk={dusk} />
              <div className="viewer-controls" aria-label="3D model controls">
                <Toggle active={louversOpen} onChange={() => setLouversOpen(!louversOpen)} label="Open louvers" />
                <Toggle active={yardVisible} onChange={() => setYardVisible(!yardVisible)} label="Yard visible" />
                <Toggle active={dusk} onChange={() => setDusk(!dusk)} label="Evening light" />
              </div>
            </div>
            <div className="studio-panel">
              <span>{selectedModel.tag}</span>
              <h2 id="studio-model-title">{selectedModel.name}</h2>
              <p>{selectedModel.description}. Configure the key visual details, then attach them to a project request.</p>
              <div className="studio-spec-row"><span><small>Wind</small><b>{selectedModel.wind}</b></span><span><small>Span</small><b>{selectedModel.span}</b></span><span><small>Snow</small><b>{selectedModel.snow}</b></span></div>
              <div className="studio-option"><div><span>Finish</span><b>{finishes[selectedFinish].name}</b></div><div className="studio-finish-options">{finishes.map((finish, index) => <button key={finish.name} className={selectedFinish === index ? "is-selected" : ""} onClick={() => setSelectedFinish(index)} aria-label={`Select ${finish.name} finish`}><i style={{ background: finish.value }} /><span>{finish.name}</span></button>)}</div></div>
              <div className="studio-option"><div><span>Footprint</span><b>{sizes[selectedSize].label}</b></div><div className="studio-size-options">{sizes.map((size, index) => <button key={size.label} className={selectedSize === index ? "is-selected" : ""} onClick={() => setSelectedSize(index)}><b>{size.label}</b><small>{size.meta}</small></button>)}</div></div>
              <div className="studio-total"><span>Configured estimate</span><strong>{money(total)}</strong></div>
              <button className="studio-brief-button" onClick={addModelToBrief}>Add to project brief <b>→</b></button>
            </div>
          </section>
        </div>
      )}

      {briefOpen && (
        <div className="brief-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBriefOpen(false)}>
          <aside className="brief-panel" role="dialog" aria-modal="true" aria-labelledby="brief-title">
            <div className="brief-header"><div><span>Coordinatez project studio</span><b>{selectedModel.name}</b></div><button onClick={() => setBriefOpen(false)} aria-label="Close project brief">×</button></div>
            {submitState === "success" ? (
              <div className="brief-success" aria-live="polite"><i>✓</i><span>Project brief received</span><h2>We have your<br />configuration.</h2><p>A studio specialist can now review your selected model and contact details.</p><div><small>Reference</small><strong>{reference}</strong></div><button onClick={() => { setBriefOpen(false); setBrief(emptyBrief); }}>Return to models →</button></div>
            ) : (
              <form className="brief-form" onSubmit={submitBrief}>
                <div className="brief-intro"><span>Start your project</span><h2>Bring us<br />your outside.</h2><p>Share a few details and the complete model configuration will arrive with your request.</p></div>
                <div className="brief-summary"><span><small>Model</small><b>{selectedModel.name.replace(" Motorized Pergola", "")}</b></span><span><small>Footprint</small><b>{sizes[selectedSize].label}</b></span><span><small>Finish</small><b>{finishes[selectedFinish].name}</b></span><span><small>Estimate</small><b>{money(total)}</b></span></div>
                <div className="form-grid">
                  <label><span>Name *</span><input required minLength={2} maxLength={100} autoComplete="name" value={brief.name} onChange={(event) => setBrief({ ...brief, name: event.target.value })} placeholder="Your name" /></label>
                  <label><span>Email *</span><input required type="email" maxLength={180} autoComplete="email" value={brief.email} onChange={(event) => setBrief({ ...brief, email: event.target.value })} placeholder="you@example.com" /></label>
                  <label><span>Phone</span><input type="tel" maxLength={40} autoComplete="tel" value={brief.phone} onChange={(event) => setBrief({ ...brief, phone: event.target.value })} placeholder="(555) 000-0000" /></label>
                  <label><span>Project ZIP</span><input maxLength={20} autoComplete="postal-code" value={brief.postalCode} onChange={(event) => setBrief({ ...brief, postalCode: event.target.value })} placeholder="00000" /></label>
                  <label className="full"><span>Tell us about the space</span><textarea maxLength={2500} rows={4} value={brief.notes} onChange={(event) => setBrief({ ...brief, notes: event.target.value })} placeholder="Dimensions, surface, timing, or anything we should know…" /></label>
                  <label className="form-trap" aria-hidden="true"><span>Website</span><input tabIndex={-1} autoComplete="off" value={brief.companyWebsite} onChange={(event) => setBrief({ ...brief, companyWebsite: event.target.value })} /></label>
                </div>
                <label className="brief-consent"><input type="checkbox" required checked={brief.consent} onChange={(event) => setBrief({ ...brief, consent: event.target.checked })} /><span /><p>I agree that Coordinatez may contact me about this project request.</p></label>
                {submitState === "error" && <p className="brief-error" role="alert">{submitMessage}</p>}
                <button className="brief-submit" type="submit" disabled={submitState === "sending"}><span>{submitState === "sending" ? "Sending project…" : "Send project brief"}</span><b>→</b></button>
                <p className="brief-privacy">Your details are used only to respond to this project request.</p>
              </form>
            )}
          </aside>
        </div>
      )}

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status"><i>✓</i><div><b>Project brief received</b><span>{selectedModel.name} · {money(total)}</span></div></div>
    </div>
  );
}
