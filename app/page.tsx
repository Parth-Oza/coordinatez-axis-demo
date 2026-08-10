"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

declare const __BRIEF_API_URL_B64__: string | undefined;

const PUBLIC_DEMO_ORIGIN = "https://coordinatez-axis-demo.ozaparth055.workers.dev";

type Vec3 = { x: number; y: number; z: number };
type Face = { points: { x: number; y: number }[]; depth: number; color: string };
type WallSide = "front" | "rear" | "left" | "right";
type WallSelections = Record<WallSide, boolean>;
type SceneTheme = "garden" | "desert";
type MechanismSound = "louvers" | "wall";
type WeatherMode = "clear" | "sun" | "rain" | "evening" | "wind";
type SavedDesign = {
  id: string;
  name: string;
  sizeIndex: number;
  finishIndex: number;
  wallSides: WallSelections;
  heater: boolean;
  furnished: boolean;
  theme: SceneTheme;
  weather: WeatherMode;
  total: number;
  createdAt: string;
};
type BriefForm = {
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  notes: string;
  consent: boolean;
  companyWebsite: string;
};

const defaultWallSelections: WallSelections = {
  front: false,
  rear: true,
  left: true,
  right: false,
};

const wallSideOptions: Array<{ side: WallSide; label: string }> = [
  { side: "front", label: "Front" },
  { side: "rear", label: "Rear" },
  { side: "left", label: "Left" },
  { side: "right", label: "Right" },
];

function selectedWallCount(walls: WallSelections) {
  return wallSideOptions.reduce((count, option) => count + (walls[option.side] ? 1 : 0), 0);
}

let mechanismAudioContext: AudioContext | null = null;

function startAmbientScore(moodIndex: number) {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return () => undefined;
  const context = new window.AudioContext();
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const now = context.currentTime;
  const chords = [[110, 164.81, 220], [98, 146.83, 196], [123.47, 185, 246.94]][moodIndex] ?? [110, 164.81, 220];
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(760, now);
  filter.Q.setValueAtTime(0.7, now);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.027, now + 1.4);
  filter.connect(master);
  master.connect(context.destination);

  const oscillators = chords.map((frequency, index) => {
    const oscillator = context.createOscillator();
    const voice = context.createGain();
    oscillator.type = index === 1 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency / (index === 2 ? 2 : 1), now);
    oscillator.detune.setValueAtTime(index * 3 - 2, now);
    voice.gain.setValueAtTime(index === 0 ? 0.58 : 0.24, now);
    oscillator.connect(voice);
    voice.connect(filter);
    oscillator.start(now);
    return oscillator;
  });

  const lfo = context.createOscillator();
  const lfoDepth = context.createGain();
  lfo.frequency.setValueAtTime(0.075, now);
  lfoDepth.gain.setValueAtTime(120, now);
  lfo.connect(lfoDepth);
  lfoDepth.connect(filter.frequency);
  lfo.start(now);
  void context.resume().catch(() => undefined);

  return () => {
    const stopAt = context.currentTime + 0.55;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    for (const oscillator of oscillators) oscillator.stop(stopAt + 0.05);
    lfo.stop(stopAt + 0.05);
    window.setTimeout(() => void context.close().catch(() => undefined), 700);
  };
}

function playMechanismSound(kind: MechanismSound) {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;
  try {
    mechanismAudioContext ??= new window.AudioContext();
    const context = mechanismAudioContext;
    const play = () => {
      const now = context.currentTime;
      const duration = kind === "wall" ? 0.86 : 0.62;
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(kind === "wall" ? 520 : 720, now);
      filter.Q.setValueAtTime(1.4, now);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.055, now + 0.035);
      master.gain.exponentialRampToValueAtTime(0.014, now + duration * 0.72);
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      filter.connect(master);
      master.connect(context.destination);

      const motor = context.createOscillator();
      motor.type = "sawtooth";
      motor.frequency.setValueAtTime(kind === "wall" ? 82 : 118, now);
      motor.frequency.exponentialRampToValueAtTime(kind === "wall" ? 48 : 72, now + duration);
      motor.connect(filter);
      motor.start(now);
      motor.stop(now + duration);

      const mechanical = context.createOscillator();
      const mechanicalGain = context.createGain();
      mechanical.type = "square";
      mechanical.frequency.setValueAtTime(kind === "louvers" ? 21 : 16, now);
      mechanicalGain.gain.setValueAtTime(0.008, now);
      mechanicalGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      mechanical.connect(mechanicalGain);
      mechanicalGain.connect(master);
      mechanical.start(now);
      mechanical.stop(now + duration);

      const latch = context.createOscillator();
      const latchGain = context.createGain();
      latch.type = "sine";
      latch.frequency.setValueAtTime(270, now + duration - 0.045);
      latchGain.gain.setValueAtTime(0.0001, now);
      latchGain.gain.setValueAtTime(0.025, now + duration - 0.045);
      latchGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.045);
      latch.connect(latchGain);
      latchGain.connect(context.destination);
      latch.start(now + duration - 0.045);
      latch.stop(now + duration + 0.05);
    };
    if (context.state === "suspended") void context.resume().then(play);
    else play();
  } catch {
    // Audio feedback is an enhancement; the configurator remains fully usable without it.
  }
}

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
  { label: "10′ × 10′", meta: "4 posts", price: 6890, slug: "10x10", width: 10, depth: 10 },
  { label: "10′ × 13′", meta: "4 posts", price: 7790, slug: "10x13", width: 10, depth: 13 },
  { label: "13′ × 13′", meta: "4 posts", price: 9290, slug: "13x13", width: 13, depth: 13 },
  { label: "13′ × 20′", meta: "6 posts", price: 13490, slug: "13x20", width: 13, depth: 20 },
];

const viewerFootprints = [
  { width: 6, depth: 4.1, posts: 4 },
  { width: 6, depth: 5.25, posts: 4 },
  { width: 7.15, depth: 5.25, posts: 4 },
  { width: 7.15, depth: 7.4, posts: 6 },
] as const;

function viewerCameraPreset(sizeIndex: number) {
  const footprint = viewerFootprints[sizeIndex] ?? viewerFootprints[0];
  const extent = Math.max(footprint.width, footprint.depth);
  const distance = extent * 1.56;
  return {
    position: new THREE.Vector3(distance * 0.62, 2 + extent * 0.3, distance * 0.82),
    target: new THREE.Vector3(0, 1.42, -0.12),
    extent,
  };
}

const finishes = [
  { name: "Carbon", value: "#414946", slug: "carbon" },
  { name: "Cloud", value: "#d5d8d3", slug: "cloud" },
  { name: "Sand", value: "#a78d67", slug: "sand" },
];

const weatherPresets: Array<{ mode: WeatherMode; label: string; note: string; icon: string }> = [
  { mode: "clear", label: "Clear", note: "Open-air daylight", icon: "○" },
  { mode: "sun", label: "Strong sun", note: "Louvers shade the room", icon: "☀" },
  { mode: "rain", label: "Rain", note: "Roof seals and drains", icon: "≋" },
  { mode: "evening", label: "Evening", note: "Perimeter light warms", icon: "◐" },
  { mode: "wind", label: "High wind", note: "Screens safely retract", icon: "≈" },
];

const configurationSteps = ["Footprint", "Finish", "Screens", "Comfort", "Environment", "Weather", "Review"];

const announcementSlides = [
  {
    title: "Summer studio",
    copy: "Complimentary delivery on every Axis configuration.",
    action: "Explore the system →",
    href: "#configure",
  },
  {
    title: "POWER+ Gen 2",
    copy: "Motorized 120° louvers, integrated power and all-season control.",
    action: "See the specification →",
    href: "#specifications",
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

const assemblyChapters = [
  "Site survey & kit inventory",
  "Footprint layout",
  "Base plate positioning",
  "Post anchoring",
  "Primary beam assembly",
  "Secondary beam assembly",
  "Frame squaring",
  "Drainage channel setup",
  "Motor beam installation",
  "Louver axle alignment",
  "Louver panel installation",
  "Electrical routing",
  "LED commissioning",
  "Wall screen setup",
  "Final calibration & test",
].map((title, index) => ({
  title,
  index: String(index + 1).padStart(2, "0"),
  duration: index < 4 ? "04:20" : index < 10 ? "06:10" : "03:45",
  video: ["/coordinatez-film-living.mp4", "/coordinatez-film-control.mp4", "/coordinatez-film-louvers.mp4"][index % 3],
  poster: ["/coordinatez-film-living.avif", "/coordinatez-film-control.avif", "/coordinatez-film-louvers.avif"][index % 3],
}));

const competitorRows = [
  ["Price range", "$6,890–$18,990", "$7,488–$17,238", "$7,990–$17,990", "$40,000+"],
  ["Available sizes", "Extended options", "Limited", "Limited", "Custom only"],
  ["Wind resistance", "80–160 MPH", "Up to 165 MPH", "90 MPH", "100–120 MPH"],
  ["Snow load", "20–50 PSF", "Up to 60 PSF", "25 PSF", "20–40 PSF"],
  ["Integrated outlets", "110V + USB-C", "No", "No", "Optional"],
  ["Beam wiring", "Prewired", "110V", "No", "No"],
  ["LED lighting", "Integrated", "Optional", "Optional", "Optional"],
  ["Louver roof", "Motorized standard", "Optional", "Motorized standard", "Optional"],
  ["Assembly target", "2–4 hours / 4 people", "4–8 hours", "4–8 hours", "8+ hours"],
  ["Delivery target", "3–15 days", "4–8 weeks", "4–8 weeks", "8–12 weeks"],
];

const lifestyleScenes = [
  { title: "Infinity-edge mornings", location: "Coastal retreat", image: "/coordinatez-lifestyle-pool.avif" },
  { title: "The family table", location: "Garden dining", image: "/coordinatez-lifestyle-family.avif" },
  { title: "Blue-hour firelight", location: "Desert terrace", image: "/coordinatez-lifestyle-desert.avif" },
  { title: "A room for rainy days", location: "Forest hillside", image: "/coordinatez-lifestyle-rain.avif" },
  { title: "Long evenings outside", location: "Entertaining", image: "/coordinatez-film-living.avif" },
  { title: "Control in one hand", location: "Connected living", image: "/coordinatez-film-control.avif" },
  { title: "Light shaped precisely", location: "Daylight study", image: "/coordinatez-film-louvers.avif" },
];

const showroomScenes = [
  { city: "Austin", note: "Outdoor systems studio", image: "/coordinatez-lifestyle-family.avif" },
  { city: "Palm Springs", note: "Desert performance gallery", image: "/coordinatez-lifestyle-desert.avif" },
  { city: "Seattle", note: "All-weather experience", image: "/coordinatez-lifestyle-rain.avif" },
  { city: "San Diego", note: "Coastal living showroom", image: "/coordinatez-lifestyle-pool.avif" },
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
  sizeIndex,
  wallSides,
  theme,
  furnished = true,
}: {
  finish: string;
  louversOpen: boolean;
  yardVisible: boolean;
  dusk: boolean;
  sizeIndex: number;
  wallSides: WallSelections;
  theme: SceneTheme;
  furnished?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const liveStateRef = useRef({ finish, louversOpen, yardVisible, dusk, wallSides, theme, furnished });
  const [viewerReady, setViewerReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    liveStateRef.current = { finish, louversOpen, yardVisible, dusk, wallSides, theme, furnished };
  }, [dusk, finish, furnished, louversOpen, theme, wallSides, yardVisible]);

  const resetView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const preset = viewerCameraPreset(sizeIndex);
    camera.position.copy(preset.position);
    controls.target.copy(preset.target);
    controls.autoRotate = true;
    controls.update();
  }, [sizeIndex]);

  useEffect(() => {
    resetView();
  }, [resetView, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        precision: "highp",
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setWebglFailed(true));
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 140);
    const cameraPreset = viewerCameraPreset(sizeIndex);
    camera.position.copy(cameraPreset.position);
    cameraRef.current = camera;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const physicalEnvironment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = physicalEnvironment;
    scene.environmentIntensity = 0.78;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 7 + cameraPreset.extent * 0.2;
    controls.maxDistance = 19 + cameraPreset.extent * 0.8;
    controls.minPolarAngle = 0.72;
    controls.maxPolarAngle = 1.43;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.72;
    controls.target.copy(cameraPreset.target);
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

    const studioSky = makeSky(["#ffffff", "#f0f2ed", "#cbd2cc"]);
    scene.background = studioSky;
    scene.backgroundBlurriness = 0;
    const panoramaBase = window.location.pathname.startsWith("/coordinatez-axis-demo")
      ? "/coordinatez-axis-demo/"
      : "/";
    const panoramaTextures: Record<SceneTheme, THREE.Texture | null> = { garden: null, desert: null };
    const panoramaEnvironments: Record<SceneTheme, THREE.Texture | null> = { garden: null, desert: null };
    const panoramaLoading: Record<SceneTheme, boolean> = { garden: false, desert: false };
    let panoramaLoaded = false;
    let disposed = false;
    const textureLoader = new THREE.TextureLoader();
    const loadPanorama = (sceneTheme: SceneTheme) => {
      if (panoramaTextures[sceneTheme] || panoramaLoading[sceneTheme]) return;
      panoramaLoading[sceneTheme] = true;
      const filename = sceneTheme === "desert"
        ? "coordinatez-desert-house-panorama.jpg"
        : "coordinatez-garden-house-panorama.jpg";
      textureLoader.load(
        `${panoramaBase}${filename}`,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          panoramaTextures[sceneTheme] = texture;
          panoramaEnvironments[sceneTheme] = pmremGenerator.fromEquirectangular(texture).texture;
          panoramaLoading[sceneTheme] = false;
          if (liveStateRef.current.yardVisible && liveStateRef.current.theme === sceneTheme) {
            scene.background = texture;
            scene.environment = panoramaEnvironments[sceneTheme];
            scene.environmentIntensity = 0.72;
          }
          panoramaLoaded = true;
        },
        undefined,
        () => {
          panoramaLoading[sceneTheme] = false;
          panoramaLoaded = true;
        },
      );
    };
    loadPanorama(liveStateRef.current.theme);

    const woodCanvas = document.createElement("canvas");
    woodCanvas.width = 2048;
    woodCanvas.height = 2048;
    const woodContext = woodCanvas.getContext("2d");
    if (woodContext) {
      const base = woodContext.createLinearGradient(0, 0, 2048, 2048);
      base.addColorStop(0, "#c6a37a");
      base.addColorStop(0.5, "#9d7653");
      base.addColorStop(1, "#b58b61");
      woodContext.fillStyle = base;
      woodContext.fillRect(0, 0, 2048, 2048);
      for (let x = 0; x <= 2048; x += 256) {
        woodContext.strokeStyle = "rgba(48,27,15,.46)";
        woodContext.lineWidth = 5;
        woodContext.beginPath();
        woodContext.moveTo(x, 0);
        woodContext.lineTo(x, 2048);
        woodContext.stroke();
        woodContext.strokeStyle = "rgba(255,236,207,.2)";
        woodContext.lineWidth = 2;
        woodContext.beginPath();
        woodContext.moveTo(x + 6, 0);
        woodContext.lineTo(x + 10, 2048);
        woodContext.stroke();
      }
      for (let index = 0; index < 150; index += 1) {
        const y = index * 13.7;
        woodContext.strokeStyle = `rgba(60,34,19,${0.035 + (index % 4) * 0.012})`;
        woodContext.lineWidth = 1.2;
        woodContext.beginPath();
        woodContext.moveTo(0, y);
        for (let x = 0; x <= 2048; x += 96) {
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

    const stoneCanvas = document.createElement("canvas");
    stoneCanvas.width = 2048;
    stoneCanvas.height = 2048;
    const stoneBumpCanvas = document.createElement("canvas");
    stoneBumpCanvas.width = 2048;
    stoneBumpCanvas.height = 2048;
    const stoneContext = stoneCanvas.getContext("2d");
    const stoneBumpContext = stoneBumpCanvas.getContext("2d");
    const seeded = (index: number) => {
      const value = Math.sin(index * 91.731 + 12.87) * 43758.5453;
      return value - Math.floor(value);
    };
    if (stoneContext && stoneBumpContext) {
      stoneContext.fillStyle = "#c9c2b6";
      stoneContext.fillRect(0, 0, 2048, 2048);
      stoneBumpContext.fillStyle = "#9a9a96";
      stoneBumpContext.fillRect(0, 0, 2048, 2048);
      const tileWidth = 512;
      const tileHeight = 410;
      for (let row = -1; row < 6; row += 1) {
        for (let column = -1; column < 5; column += 1) {
          const index = (row + 1) * 7 + column + 2;
          const x = column * tileWidth + (row % 2 ? -tileWidth / 2 : 0);
          const y = row * tileHeight;
          const tone = Math.round(204 + seeded(index) * 24);
          stoneContext.fillStyle = `rgb(${tone + 7},${tone + 3},${tone - 5})`;
          stoneContext.fillRect(x + 4, y + 4, tileWidth - 8, tileHeight - 8);
          stoneContext.strokeStyle = "rgba(113,105,94,.34)";
          stoneContext.lineWidth = 5;
          stoneContext.strokeRect(x + 2.5, y + 2.5, tileWidth - 5, tileHeight - 5);
          stoneContext.strokeStyle = "rgba(255,255,255,.34)";
          stoneContext.lineWidth = 1.5;
          stoneContext.strokeRect(x + 7, y + 7, tileWidth - 14, tileHeight - 14);
          const bumpTone = Math.round(142 + seeded(index + 33) * 24);
          stoneBumpContext.fillStyle = `rgb(${bumpTone},${bumpTone},${bumpTone})`;
          stoneBumpContext.fillRect(x + 5, y + 5, tileWidth - 10, tileHeight - 10);
          stoneBumpContext.strokeStyle = "#4c4c49";
          stoneBumpContext.lineWidth = 8;
          stoneBumpContext.strokeRect(x + 3, y + 3, tileWidth - 6, tileHeight - 6);
        }
      }
      for (let index = 0; index < 4800; index += 1) {
        const x = seeded(index * 2 + 88) * 2048;
        const y = seeded(index * 2 + 89) * 2048;
        const radius = 0.35 + seeded(index + 99) * 1.7;
        stoneContext.fillStyle = `rgba(88,77,64,${0.018 + seeded(index + 250) * 0.045})`;
        stoneContext.beginPath();
        stoneContext.arc(x, y, radius, 0, Math.PI * 2);
        stoneContext.fill();
        stoneBumpContext.fillStyle = `rgba(205,205,200,${0.08 + seeded(index + 450) * 0.14})`;
        stoneBumpContext.fillRect(x, y, radius, radius);
      }
    }
    const stoneTexture = new THREE.CanvasTexture(stoneCanvas);
    stoneTexture.colorSpace = THREE.SRGBColorSpace;
    stoneTexture.wrapS = THREE.RepeatWrapping;
    stoneTexture.wrapT = THREE.RepeatWrapping;
    stoneTexture.repeat.set(5.5, 5.5);
    stoneTexture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
    const stoneBumpTexture = new THREE.CanvasTexture(stoneBumpCanvas);
    stoneBumpTexture.wrapS = THREE.RepeatWrapping;
    stoneBumpTexture.wrapT = THREE.RepeatWrapping;
    stoneBumpTexture.repeat.copy(stoneTexture.repeat);

    const finishRoughnessCanvas = document.createElement("canvas");
    finishRoughnessCanvas.width = 512;
    finishRoughnessCanvas.height = 512;
    const finishRoughnessContext = finishRoughnessCanvas.getContext("2d");
    if (finishRoughnessContext) {
      const image = finishRoughnessContext.createImageData(512, 512);
      for (let index = 0; index < image.data.length; index += 4) {
        const grain = Math.round(118 + seeded(index) * 38);
        image.data[index] = grain;
        image.data[index + 1] = grain;
        image.data[index + 2] = grain;
        image.data[index + 3] = 255;
      }
      finishRoughnessContext.putImageData(image, 0, 0);
    }
    const finishRoughnessTexture = new THREE.CanvasTexture(finishRoughnessCanvas);
    finishRoughnessTexture.wrapS = THREE.RepeatWrapping;
    finishRoughnessTexture.wrapT = THREE.RepeatWrapping;
    finishRoughnessTexture.repeat.set(7, 7);

    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 512;
    screenCanvas.height = 512;
    const screenContext = screenCanvas.getContext("2d");
    if (screenContext) {
      const screenGradient = screenContext.createLinearGradient(0, 0, 512, 512);
      screenGradient.addColorStop(0, "#36453f");
      screenGradient.addColorStop(0.5, "#202b27");
      screenGradient.addColorStop(1, "#3c4943");
      screenContext.fillStyle = screenGradient;
      screenContext.fillRect(0, 0, 512, 512);
      for (let thread = 0; thread <= 512; thread += 8) {
        screenContext.strokeStyle = thread % 24 === 0 ? "rgba(214,226,217,.2)" : "rgba(221,231,224,.09)";
        screenContext.lineWidth = thread % 24 === 0 ? 1.4 : 0.8;
        screenContext.beginPath();
        screenContext.moveTo(thread, 0);
        screenContext.lineTo(thread, 512);
        screenContext.stroke();
        screenContext.strokeStyle = thread % 24 === 0 ? "rgba(5,10,8,.32)" : "rgba(5,10,8,.2)";
        screenContext.beginPath();
        screenContext.moveTo(0, thread);
        screenContext.lineTo(512, thread);
        screenContext.stroke();
      }
    }
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.wrapS = THREE.RepeatWrapping;
    screenTexture.wrapT = THREE.RepeatWrapping;
    screenTexture.repeat.set(10, 8);
    screenTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const aluminum = new THREE.MeshPhysicalMaterial({
      color: liveStateRef.current.finish,
      metalness: 0.46,
      roughness: 0.38,
      roughnessMap: finishRoughnessTexture,
      clearcoat: 0.14,
      clearcoatRoughness: 0.36,
    });
    const louverMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(liveStateRef.current.finish).offsetHSL(0, 0, -0.025),
      metalness: 0.44,
      roughness: 0.37,
      roughnessMap: finishRoughnessTexture,
      clearcoat: 0.12,
      clearcoatRoughness: 0.38,
    });
    const channelMaterial = new THREE.MeshStandardMaterial({ color: "#141a18", metalness: 0.76, roughness: 0.27 });
    const fastenerMaterial = new THREE.MeshStandardMaterial({ color: "#8f9793", metalness: 0.94, roughness: 0.17 });
    const gasketMaterial = new THREE.MeshStandardMaterial({ color: "#090d0c", metalness: 0.08, roughness: 0.7 });
    const deckMaterial = new THREE.MeshStandardMaterial({ map: woodTexture, color: "#ffffff", roughness: 0.72, metalness: 0.03 });
    const patioMaterial = new THREE.MeshPhysicalMaterial({
      map: stoneTexture,
      bumpMap: stoneBumpTexture,
      bumpScale: 0.018,
      color: "#e5dfd3",
      metalness: 0.01,
      roughness: 0.86,
      clearcoat: 0.025,
      clearcoatRoughness: 0.72,
    });
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
    const contactShadowCanvas = document.createElement("canvas");
    contactShadowCanvas.width = 192;
    contactShadowCanvas.height = 192;
    const contactShadowContext = contactShadowCanvas.getContext("2d");
    if (contactShadowContext) {
      const contact = contactShadowContext.createRadialGradient(96, 96, 16, 96, 96, 94);
      contact.addColorStop(0, "rgba(9,15,11,.58)");
      contact.addColorStop(0.42, "rgba(9,15,11,.32)");
      contact.addColorStop(1, "rgba(9,15,11,0)");
      contactShadowContext.fillStyle = contact;
      contactShadowContext.fillRect(0, 0, 192, 192);
    }
    const contactShadowTexture = new THREE.CanvasTexture(contactShadowCanvas);
    const contactShadowMaterial = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
    });
    const screenMaterial = new THREE.MeshPhysicalMaterial({
      map: screenTexture,
      color: "#6f7d76",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      metalness: 0.02,
      roughness: 0.88,
      clearcoat: 0.04,
      clearcoatRoughness: 0.9,
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

    const footprint = viewerFootprints[sizeIndex] ?? viewerFootprints[0];
    const halfWidth = footprint.width / 2;
    const halfDepth = footprint.depth / 2;
    const deck: THREE.Mesh<THREE.BufferGeometry, THREE.Material> = new THREE.Mesh(
      new RoundedBoxGeometry(footprint.width + 5.4, 0.09, footprint.depth + 5.1, 4, 0.08),
      patioMaterial,
    );
    deck.position.y = -0.068;
    deck.receiveShadow = true;
    scene.add(deck);

    const shadowCatcher = new THREE.Mesh(
      new THREE.CircleGeometry(42, 96),
      new THREE.ShadowMaterial({ color: "#132019", opacity: 0.075 }),
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.116;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    const realWorldContext = new THREE.Group();
    realWorldContext.name = "real-world-house-context";
    scene.add(realWorldContext);
    const threshold = addBox(
      realWorldContext,
      [footprint.width + 4.2, 0.12, 0.58],
      [0, -0.005, -(halfDepth + 2.05)],
      patioMaterial,
      false,
      true,
    );
    threshold.rotation.x = -0.008;

    const innerWidth = footprint.width - 0.18;
    const innerDepth = footprint.depth - 0.3;
    const frameFrontZ = halfDepth + 0.03;
    const frameSideX = halfWidth + 0.08;

    const pergola = new THREE.Group();
    pergola.position.y = 0.015;
    scene.add(pergola);
    const postAnchors: Array<[number, number]> = [
      [-halfWidth, -halfDepth], [-halfWidth, halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth],
    ];
    if (footprint.posts === 6) postAnchors.push([-halfWidth, 0], [halfWidth, 0]);
    const boltGeometry = new THREE.CylinderGeometry(0.041, 0.041, 0.036, 6);
    const washerGeometry = new THREE.CylinderGeometry(0.068, 0.068, 0.012, 28);
    for (const [x, z] of postAnchors) {
      const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.62), contactShadowMaterial);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.set(x, -0.011, z);
      contactShadow.renderOrder = 2;
      pergola.add(contactShadow);
      addBox(pergola, [0.58, 0.022, 0.58], [x, 0.011, z], gasketMaterial, false, true);
      addBox(pergola, [0.54, 0.068, 0.54], [x, 0.056, z], aluminum, true, true);
      addBox(pergola, [0.365, 0.145, 0.365], [x, 0.145, z], aluminum, true, true);
      addBox(pergola, [0.255, 2.94, 0.255], [x, 1.685, z], aluminum, true, true);
      addBox(pergola, [0.012, 2.68, 0.03], [x + Math.sign(x || 1) * 0.128, 1.71, z], gasketMaterial, false, false);
      addBox(pergola, [0.03, 2.68, 0.012], [x, 1.71, z + Math.sign(z || 1) * 0.128], gasketMaterial, false, false);
      addBox(pergola, [0.285, 0.055, 0.285], [x, 3.08, z], channelMaterial, true, true);
      for (const boltX of [-0.19, 0.19]) {
        for (const boltZ of [-0.19, 0.19]) {
          const washer = new THREE.Mesh(washerGeometry, fastenerMaterial);
          washer.position.set(x + boltX, 0.099, z + boltZ);
          washer.castShadow = true;
          pergola.add(washer);
          const bolt = new THREE.Mesh(boltGeometry, fastenerMaterial);
          bolt.position.set(x + boltX, 0.122, z + boltZ);
          bolt.castShadow = true;
          pergola.add(bolt);
        }
      }
    }

    addBox(pergola, [footprint.width + 0.5, 0.36, 0.34], [0, 3.2, -frameFrontZ], aluminum);
    addBox(pergola, [footprint.width + 0.5, 0.36, 0.34], [0, 3.2, frameFrontZ], aluminum);
    addBox(pergola, [0.34, 0.36, footprint.depth + 0.4], [-frameSideX, 3.2, 0], aluminum);
    addBox(pergola, [0.34, 0.36, footprint.depth + 0.4], [frameSideX, 3.2, 0], aluminum);
    addBox(pergola, [footprint.width + 0.1, 0.085, 0.15], [0, 3.02, -(halfDepth - 0.1)], gasketMaterial);
    addBox(pergola, [footprint.width + 0.1, 0.085, 0.15], [0, 3.02, halfDepth - 0.1], gasketMaterial);
    addBox(pergola, [0.145, 0.16, footprint.depth - 0.18], [-(halfWidth - 0.1), 3.05, 0], gasketMaterial);
    addBox(pergola, [0.145, 0.16, footprint.depth - 0.18], [halfWidth - 0.1, 3.05, 0], gasketMaterial);
    addBox(pergola, [footprint.width + 0.2, 0.055, 0.035], [0, 3.335, frameFrontZ + 0.17], fastenerMaterial, false, false);
    addBox(pergola, [footprint.width + 0.2, 0.055, 0.035], [0, 3.335, -frameFrontZ - 0.17], fastenerMaterial, false, false);
    const motorHousing = addBox(pergola, [0.4, 0.32, 1.02], [halfWidth + 0.17, 3.16, -(halfDepth - 0.68)], aluminum);
    motorHousing.rotation.z = -0.012;
    addBox(pergola, [0.08, 0.18, 0.72], [halfWidth + 0.355, 3.15, -(halfDepth - 0.68)], gasketMaterial, false, false);
    const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.035, 20), fastenerMaterial);
    motorCap.rotation.z = Math.PI / 2;
    motorCap.position.set(halfWidth + 0.375, 3.16, -(halfDepth - 0.68));
    motorCap.castShadow = true;
    pergola.add(motorCap);
    for (const [x, z] of [
      [-(halfWidth - 0.18), -(halfDepth - 0.23)], [-(halfWidth - 0.18), halfDepth - 0.23],
      [halfWidth - 0.18, -(halfDepth - 0.23)], [halfWidth - 0.18, halfDepth - 0.23],
    ] as const) {
      addBox(pergola, [0.35, 0.21, 0.35], [x, 2.97, z], channelMaterial, true, true);
    }
    addBox(pergola, [0.1, 0.29, 0.025], [halfWidth, 0.38, halfDepth + 0.131], gasketMaterial, false, false);

    type SideWallPart = {
      side: WallSide;
      assembly: THREE.Group;
      panel: THREE.Mesh;
      bottomRail: THREE.Mesh;
      topY: number;
      height: number;
      deployment: number;
    };
    const sideWallParts: SideWallPart[] = [];
    const screenTopY = 2.97;
    const screenBottomY = 0.2;
    const screenHeight = screenTopY - screenBottomY;
    const addScreenAssembly = (
      side: WallSide,
      center: number,
      span: number,
    ) => {
      const assembly = new THREE.Group();
      pergola.add(assembly);
      const horizontal = side === "front" || side === "rear";
      const clearSpan = Math.max(0.8, span - 0.14);
      const initialDeployment = liveStateRef.current.wallSides[side] ? 1 : 0.012;
      const wallZ = side === "rear" ? -halfDepth + 0.135 : halfDepth - 0.135;
      const wallX = side === "left" ? -halfWidth + 0.135 : halfWidth - 0.135;
      const inwardZ = side === "rear" ? 1 : -1;
      const inwardX = side === "left" ? 1 : -1;
      assembly.visible = liveStateRef.current.wallSides[side];

      if (horizontal) {
        addBox(assembly, [span, 0.21, 0.24], [center, screenTopY + 0.015, wallZ], aluminum, true, true);
        addBox(assembly, [span - 0.12, 0.055, 0.035], [center, screenTopY - 0.1, wallZ + inwardZ * 0.135], channelMaterial, false, false);
        for (const edge of [-span / 2, span / 2]) {
          addBox(assembly, [0.075, screenHeight + 0.03, 0.115], [center + edge, (screenTopY + screenBottomY) / 2, wallZ], aluminum, true, true);
          addBox(assembly, [0.022, screenHeight - 0.12, 0.025], [center + edge + Math.sign(-edge || 1) * 0.045, (screenTopY + screenBottomY) / 2, wallZ + inwardZ * 0.065], gasketMaterial, false, false);
        }
      } else {
        addBox(assembly, [0.24, 0.21, span], [wallX, screenTopY + 0.015, center], aluminum, true, true);
        addBox(assembly, [0.035, 0.055, span - 0.12], [wallX + inwardX * 0.135, screenTopY - 0.1, center], channelMaterial, false, false);
        for (const edge of [-span / 2, span / 2]) {
          addBox(assembly, [0.115, screenHeight + 0.03, 0.075], [wallX, (screenTopY + screenBottomY) / 2, center + edge], aluminum, true, true);
          addBox(assembly, [0.025, screenHeight - 0.12, 0.022], [wallX + inwardX * 0.065, (screenTopY + screenBottomY) / 2, center + edge + Math.sign(-edge || 1) * 0.045], gasketMaterial, false, false);
        }
      }

      const panel = new THREE.Mesh(new THREE.PlaneGeometry(clearSpan, screenHeight, 1, 24), screenMaterial);
      panel.scale.y = initialDeployment;
      panel.position.y = screenTopY - (screenHeight * initialDeployment) / 2;
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.renderOrder = 1;
      if (horizontal) panel.position.set(center, panel.position.y, wallZ + inwardZ * 0.008);
      else {
        panel.position.set(wallX + inwardX * 0.008, panel.position.y, center);
        panel.rotation.y = Math.PI / 2;
      }
      assembly.add(panel);

      const bottomRail = horizontal
        ? addBox(assembly, [clearSpan + 0.08, 0.105, 0.11], [center, screenTopY - screenHeight * initialDeployment, wallZ], aluminum, true, true)
        : addBox(assembly, [0.11, 0.105, clearSpan + 0.08], [wallX, screenTopY - screenHeight * initialDeployment, center], aluminum, true, true);
      addBox(bottomRail, horizontal ? [0.18, 0.025, 0.125] : [0.125, 0.025, 0.18], [0, -0.06, 0], gasketMaterial, false, false);
      sideWallParts.push({ side, assembly, panel, bottomRail, topY: screenTopY, height: screenHeight, deployment: initialDeployment });
    };

    addScreenAssembly("rear", 0, footprint.width - 0.46);
    addScreenAssembly("front", 0, footprint.width - 0.46);
    if (footprint.posts === 6) {
      const sideSectionSpan = halfDepth - 0.27;
      addScreenAssembly("left", -halfDepth / 2, sideSectionSpan);
      addScreenAssembly("left", halfDepth / 2, sideSectionSpan);
      addScreenAssembly("right", -halfDepth / 2, sideSectionSpan);
      addScreenAssembly("right", halfDepth / 2, sideSectionSpan);
    } else {
      addScreenAssembly("left", 0, footprint.depth - 0.46);
      addScreenAssembly("right", 0, footprint.depth - 0.46);
    }

    const furnitureMetal = new THREE.MeshPhysicalMaterial({ color: "#202724", metalness: 0.56, roughness: 0.32, clearcoat: 0.16 });
    const upholsteryMaterial = new THREE.MeshPhysicalMaterial({ color: "#ded8c8", metalness: 0, roughness: 0.82, sheen: 0.22, sheenColor: new THREE.Color("#fff8e8") });
    const pillowMaterial = new THREE.MeshPhysicalMaterial({ color: "#63756b", metalness: 0, roughness: 0.9, sheen: 0.3, sheenColor: new THREE.Color("#c2d4c9") });
    const pillowAccentMaterial = new THREE.MeshPhysicalMaterial({ color: "#a87850", metalness: 0, roughness: 0.88, sheen: 0.25, sheenColor: new THREE.Color("#e4ba91") });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: "#86654a", metalness: 0.02, roughness: 0.68 });
    const counterMaterial = new THREE.MeshPhysicalMaterial({ color: "#c7c4b8", metalness: 0.04, roughness: 0.28, clearcoat: 0.48, clearcoatRoughness: 0.3 });
    const grillMaterial = new THREE.MeshPhysicalMaterial({ color: "#171b19", metalness: 0.74, roughness: 0.22, clearcoat: 0.25 });
    const furniture = new THREE.Group();
    pergola.add(furniture);

    const furnitureScale = footprint.width < 6.5 ? 0.84 : 0.94;
    furniture.scale.setScalar(furnitureScale);
    const addPatioSofa = () => {
      const sofa = new THREE.Group();
      const sofaWidth = 3.46;
      const armX = sofaWidth / 2;
      const seatXs = [-1.2, -0.4, 0.4, 1.2];
      sofa.position.set(-0.45 / furnitureScale, 0, (-halfDepth + 0.72) / furnitureScale);
      addBox(sofa, [sofaWidth, 0.2, 0.88], [0, 0.32, 0], furnitureMetal, true, true);
      addBox(sofa, [sofaWidth - 0.12, 0.16, 0.68], [0, 0.51, 0.05], accentMaterial, true, true);
      addBox(sofa, [sofaWidth - 0.12, 0.56, 0.12], [0, 0.78, -0.39], furnitureMetal, true, true);
      addBox(sofa, [0.78, 0.2, 1.78], [seatXs[0], 0.32, 0.48], furnitureMetal, true, true);
      addBox(sofa, [0.68, 0.16, 1.66], [seatXs[0], 0.51, 0.5], accentMaterial, true, true);
      const chaiseCushion = addBox(sofa, [0.68, 0.19, 1.58], [seatXs[0], 0.63, 0.52], upholsteryMaterial, true, true);
      chaiseCushion.rotation.x = -0.012;
      for (const x of seatXs) {
        if (x !== seatXs[0]) {
          const seatCushion = addBox(sofa, [0.7, 0.19, 0.68], [x, 0.63, 0.06], upholsteryMaterial, true, true);
          seatCushion.rotation.x = -0.018;
        }
        const backCushion = addBox(sofa, [0.7, 0.66, 0.18], [x, 0.94, -0.3], upholsteryMaterial, true, true);
        backCushion.rotation.x = -0.11;
      }
      for (const side of [-armX, armX]) {
        const armDepth = side < 0 ? 1.72 : 0.84;
        const armZ = side < 0 ? 0.43 : 0;
        addBox(sofa, [0.17, 0.49, armDepth], [side, 0.54, armZ], furnitureMetal, true, true);
        addBox(sofa, [0.13, 0.11, armDepth - 0.08], [side, 0.82, armZ], accentMaterial, true, true);
        const legPositions = side < 0 ? [-0.33, 1.16] : [-0.3, 0.3];
        for (const z of legPositions) addBox(sofa, [0.09, 0.26, 0.09], [side, 0.13, z], furnitureMetal, true, true);
      }
      const leftPillow = addBox(sofa, [0.42, 0.44, 0.14], [-1.28, 0.94, -0.14], pillowMaterial, true, true);
      leftPillow.rotation.z = -0.13;
      const rightPillow = addBox(sofa, [0.4, 0.4, 0.14], [1.3, 0.92, -0.14], pillowAccentMaterial, true, true);
      rightPillow.rotation.z = 0.16;
      furniture.add(sofa);
    };
    addPatioSofa();
    addBox(furniture, [1.25, 0.12, 0.68], [0.16, 0.4, 0.52], accentMaterial, true, true);
    for (const x of [-0.3, 0.62]) {
      for (const z of [0.27, 0.77]) addBox(furniture, [0.07, 0.39, 0.07], [x, 0.2, z], furnitureMetal, true, true);
    }

    const barbecue = new THREE.Group();
    barbecue.position.set(halfWidth - 0.88, 0, halfDepth - 0.72);
    addBox(barbecue, [1.14, 0.82, 0.58], [0, 0.47, 0], grillMaterial, true, true);
    addBox(barbecue, [1.3, 0.11, 0.7], [0, 0.94, 0], counterMaterial, true, true);
    const grillHood = addBox(barbecue, [1.02, 0.48, 0.48], [0, 1.22, -0.04], grillMaterial, true, true);
    grillHood.rotation.x = -0.1;
    addBox(barbecue, [0.78, 0.055, 0.06], [0, 1.2, 0.28], fastenerMaterial, true, false);
    addBox(barbecue, [0.52, 0.52, 0.03], [-0.28, 0.5, 0.305], channelMaterial, false, false);
    addBox(barbecue, [0.52, 0.52, 0.03], [0.28, 0.5, 0.305], channelMaterial, false, false);
    for (const x of [-0.28, 0, 0.28]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.055, 20), fastenerMaterial);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, 0.81, 0.34);
      knob.castShadow = true;
      barbecue.add(knob);
    }
    addBox(barbecue, [0.42, 0.08, 0.58], [0.78, 0.91, 0], counterMaterial, true, true);
    addBox(barbecue, [0.07, 0.82, 0.07], [0.91, 0.43, 0], furnitureMetal, true, true);
    furniture.add(barbecue);

    const louverMeshes: THREE.Group[] = [];
    const louverShape = new THREE.Shape();
    louverShape.moveTo(-0.13, -0.018);
    louverShape.bezierCurveTo(-0.095, -0.042, -0.01, -0.043, 0.085, -0.018);
    louverShape.lineTo(0.13, 0.012);
    louverShape.bezierCurveTo(0.095, 0.039, 0.01, 0.044, -0.09, 0.03);
    louverShape.closePath();
    const louverGeometry = new THREE.ExtrudeGeometry(louverShape, {
      depth: innerWidth,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.008,
      bevelThickness: 0.008,
    });
    louverGeometry.center();
    louverGeometry.rotateY(Math.PI / 2);
    const pivotGeometry = new THREE.CylinderGeometry(0.027, 0.027, 0.09, 14);
    pivotGeometry.rotateZ(Math.PI / 2);
    const louverCount = Math.max(18, Math.round(innerDepth / 0.235));
    const louverSpacing = innerDepth / louverCount;
    const louverStart = -((louverCount - 1) * louverSpacing) / 2;
    for (let index = 0; index < louverCount; index += 1) {
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(0, 3.19, louverStart + index * louverSpacing);
      const blade = new THREE.Mesh(louverGeometry, louverMaterial);
      blade.castShadow = true;
      blade.receiveShadow = true;
      bladeGroup.add(blade);
      addBox(bladeGroup, [innerWidth - 0.04, 0.012, 0.012], [0, 0.028, 0.112], gasketMaterial, false, false);
      for (const x of [-innerWidth / 2 - 0.025, innerWidth / 2 + 0.025]) {
        const pivot = new THREE.Mesh(pivotGeometry, fastenerMaterial);
        pivot.position.x = x;
        pivot.castShadow = true;
        bladeGroup.add(pivot);
      }
      const lever = addBox(bladeGroup, [0.12, 0.035, 0.035], [innerWidth / 2 - 0.08, -0.08, 0.02], fastenerMaterial, true, false);
      lever.rotation.x = 0.3;
      pergola.add(bladeGroup);
      louverMeshes.push(bladeGroup);
    }
    addBox(pergola, [0.045, 0.07, innerDepth - 0.16], [halfWidth - 0.03, 3.08, 0.02], fastenerMaterial, true, false);

    const frontLed = addBox(pergola, [footprint.width - 0.15, 0.024, 0.035], [0, 2.98, halfDepth - 0.14], ledMaterial, false, false);
    const rearLed = addBox(pergola, [footprint.width - 0.15, 0.024, 0.035], [0, 2.98, -(halfDepth - 0.14)], ledMaterial, false, false);
    const leftLed = addBox(pergola, [0.035, 0.024, footprint.depth - 0.48], [-(halfWidth - 0.14), 2.98, 0], ledMaterial, false, false);
    const rightLed = addBox(pergola, [0.035, 0.024, footprint.depth - 0.48], [halfWidth - 0.14, 2.98, 0], ledMaterial, false, false);
    frontLed.renderOrder = 2;
    rearLed.renderOrder = 2;
    leftLed.renderOrder = 2;
    rightLed.renderOrder = 2;

    const glowDepthPositions = footprint.posts === 6 ? [-footprint.depth * 0.23, footprint.depth * 0.23] : [0];
    for (const x of [-footprint.width * 0.3, footprint.width * 0.3]) {
      for (const z of glowDepthPositions) {
        const glowPool = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(5.4, footprint.width * 0.78), Math.min(4.6, footprint.depth * 0.86)),
          glowMaterial,
        );
        glowPool.rotation.x = -Math.PI / 2;
        glowPool.position.set(x, 0.006, z);
        glowPool.renderOrder = 3;
        pergola.add(glowPool);
      }
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
    brandPlate.position.set(Math.min(0.68, footprint.width * 0.11), 3.18, halfDepth + 0.195);
    pergola.add(brandPlate);

    const hemisphere = new THREE.HemisphereLight("#f7f8f4", "#6f746d", 1.08);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight("#fff0d3", 2.25);
    sun.position.set(11, 12, 8);
    sun.castShadow = true;
    const shadowResolution = window.innerWidth < 820 ? 1536 : 2048;
    sun.shadow.mapSize.set(shadowResolution, shadowResolution);
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -11;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.00016;
    sun.shadow.normalBias = 0.018;
    sun.shadow.radius = 4;
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#dbe8ec", 0.48);
    rim.position.set(-9, 6, 11);
    scene.add(rim);
    const warmLight = new THREE.PointLight("#ffbc73", 0, 14, 1.8);
    warmLight.position.set(3.9, 2.25, -4.9);
    scene.add(warmLight);
    const pergolaLightPositions = footprint.posts === 6
      ? [
        [-footprint.width * 0.28, 2.72, -footprint.depth * 0.22], [-footprint.width * 0.28, 2.72, footprint.depth * 0.22],
        [footprint.width * 0.28, 2.72, -footprint.depth * 0.22], [footprint.width * 0.28, 2.72, footprint.depth * 0.22],
      ]
      : [[-footprint.width * 0.31, 2.72, 0], [footprint.width * 0.31, 2.72, 0]];
    const pergolaLights = pergolaLightPositions.map(([x, y, z]) => {
      const light = new THREE.PointLight("#ffd79a", 0, 6, 2);
      light.position.set(x, y, z);
      scene.add(light);
      return light;
    });

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pixelRatioLimit = window.innerWidth < 820 ? 1.5 : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let hasRendered = false;
    let previousFrame = performance.now();
    let animationFrame = 0;
    let idleTimer = 0;
    let canvasVisible = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => { canvasVisible = entry.isIntersecting; }, { rootMargin: "180px 0px", threshold: 0.01 });
    visibilityObserver.observe(canvas);
    const render = (now = performance.now()) => {
      if (!canvasVisible || document.hidden) {
        idleTimer = window.setTimeout(() => { animationFrame = window.requestAnimationFrame(render); }, 240);
        return;
      }
      const delta = Math.min((now - previousFrame) / 1000, 0.05);
      previousFrame = now;
      const state = liveStateRef.current;
      if (state.yardVisible) loadPanorama(state.theme);
      furniture.visible = state.furnished;
      realWorldContext.visible = state.yardVisible;
      const targetColor = new THREE.Color(state.finish);
      aluminum.color.lerp(targetColor, 0.09);
      louverMaterial.color.lerp(targetColor.clone().offsetHSL(0, 0, -0.025), 0.09);
      const bladeTarget = state.louversOpen ? -Math.PI * 0.28 : 0;
      for (let index = 0; index < louverMeshes.length; index += 1) {
        const blade = louverMeshes[index];
        const response = Math.min(1, delta * (5.2 + index * 0.035));
        blade.rotation.x = THREE.MathUtils.lerp(blade.rotation.x, bladeTarget, response);
      }
      for (const wall of sideWallParts) {
        const screenTarget = state.wallSides[wall.side] ? 1 : 0.012;
        wall.assembly.visible = state.wallSides[wall.side] || wall.deployment > 0.018;
        wall.deployment = THREE.MathUtils.lerp(wall.deployment, screenTarget, Math.min(1, delta * 4.6));
        wall.panel.scale.y = wall.deployment;
        wall.panel.position.y = wall.topY - (wall.height * wall.deployment) / 2;
        wall.bottomRail.position.y = wall.topY - wall.height * wall.deployment;
        wall.panel.visible = wall.deployment > 0.018;
        wall.bottomRail.visible = wall.deployment > 0.018;
      }

      const duskMix = state.dusk ? 1 : 0;
      const activePanorama = panoramaTextures[state.theme];
      const activeEnvironment = panoramaEnvironments[state.theme];
      const panoramaRotation = Math.PI;
      scene.backgroundRotation.y = THREE.MathUtils.lerp(scene.backgroundRotation.y, panoramaRotation, 0.08);
      scene.environmentRotation.y = THREE.MathUtils.lerp(scene.environmentRotation.y, panoramaRotation, 0.08);
      scene.background = state.yardVisible && activePanorama ? activePanorama : studioSky;
      scene.environment = state.yardVisible && activeEnvironment ? activeEnvironment : physicalEnvironment;
      scene.backgroundIntensity = THREE.MathUtils.lerp(scene.backgroundIntensity, state.dusk ? 0.58 : 0.9, 0.06);
      scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, state.dusk ? 0.48 : 0.72, 0.06);
      deck.material = state.yardVisible ? patioMaterial : deckMaterial;
      patioMaterial.color.lerp(new THREE.Color(state.theme === "desert" ? "#e4d6c3" : "#dfddd5"), 0.05);
      sun.color.lerp(new THREE.Color(state.theme === "desert" ? "#ffe1b7" : "#fff0d3"), 0.05);
      hemisphere.color.lerp(new THREE.Color(state.theme === "desert" ? "#fff2df" : "#f7f8f4"), 0.05);
      hemisphere.groundColor.lerp(new THREE.Color(state.theme === "desert" ? "#75685e" : "#6f746d"), 0.05);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, state.dusk ? 0.8 : 0.9, 0.06);
      hemisphere.intensity = THREE.MathUtils.lerp(hemisphere.intensity, state.dusk ? 0.62 : 1.08, 0.07);
      sun.intensity = THREE.MathUtils.lerp(sun.intensity, state.dusk ? 0.28 : 2.25, 0.07);
      rim.intensity = THREE.MathUtils.lerp(rim.intensity, state.dusk ? 0.32 : 0.48, 0.07);
      warmLight.intensity = THREE.MathUtils.lerp(warmLight.intensity, state.dusk ? 3.2 : 0, 0.07);
      ledMaterial.emissiveIntensity = THREE.MathUtils.lerp(ledMaterial.emissiveIntensity, state.dusk ? 3.1 : 0.08, 0.1);
      glowMaterial.opacity = THREE.MathUtils.lerp(glowMaterial.opacity, state.dusk ? 0.14 : 0, 0.09);
      contactShadowMaterial.opacity = THREE.MathUtils.lerp(contactShadowMaterial.opacity, state.dusk ? 0.1 : 0.16, 0.08);
      screenMaterial.opacity = THREE.MathUtils.lerp(screenMaterial.opacity, state.dusk ? 0.7 : 0.62, 0.08);
      for (const light of pergolaLights) light.intensity = THREE.MathUtils.lerp(light.intensity, duskMix * 4.2, 0.09);

      controls.update(delta);
      renderer.render(scene, camera);
      if (!hasRendered && panoramaLoaded) {
        hasRendered = true;
        window.setTimeout(() => setViewerReady(true), 260);
      }
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(idleTimer);
      visibilityObserver.disconnect();
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
      stoneTexture.dispose();
      stoneBumpTexture.dispose();
      finishRoughnessTexture.dispose();
      screenTexture.dispose();
      glowTexture.dispose();
      contactShadowTexture.dispose();
      studioSky.dispose();
      for (const sceneTheme of ["garden", "desert"] as const) {
        panoramaTextures[sceneTheme]?.dispose();
        panoramaEnvironments[sceneTheme]?.dispose();
      }
      brandTexture.dispose();
      physicalEnvironment.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [sizeIndex]);

  if (webglFailed) {
    return <PergolaViewer finish={finish} louversOpen={louversOpen} yardVisible={yardVisible} dusk={dusk} />;
  }

  const sizeSlug = ["10x10", "10x13", "13x13", "13x20"][sizeIndex] ?? "10x10";
  const finishSlug = finishes.find((option) => option.value.toLowerCase() === finish.toLowerCase())?.name.toLowerCase() ?? "carbon";
  const arOrigin = typeof window !== "undefined" && window.location.pathname.startsWith("/coordinatez-axis-demo")
    ? "https://coordinatez-axis-demo.ozaparth055.workers.dev"
    : "";
  const arHref = `${arOrigin}/ar?size=${sizeSlug}&finish=${finishSlug}`;

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
      <a className="ar-launch-button" href={arHref}>
        <i aria-hidden="true">AR</i>
        <span><b>View in your space</b><small>iPhone + Android native AR</small></span>
        <em>↗</em>
      </a>
      <div className="viewer-badge">Photo-matched 360° environment</div>
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

function WallSidePicker({
  walls,
  onChange,
}: {
  walls: WallSelections;
  onChange: (side: WallSide) => void;
}) {
  return (
    <div className="wall-side-options" aria-label="Choose motorized wall sides">
      {wallSideOptions.map(({ side, label }) => (
        <button
          key={side}
          className={walls[side] ? "is-selected" : ""}
          onClick={() => onChange(side)}
          aria-pressed={walls[side]}
        >
          <i className={`wall-side-glyph is-${side}`} aria-hidden="true"><span /></i>
          <b>{label}</b>
          <small>+ $1,190</small>
        </button>
      ))}
    </div>
  );
}

function ThemePicker({
  theme,
  onChange,
}: {
  theme: SceneTheme;
  onChange: (theme: SceneTheme) => void;
}) {
  return (
    <div className="theme-options" aria-label="Choose scene environment">
      {(["garden", "desert"] as const).map((option) => (
        <button key={option} className={theme === option ? "is-selected" : ""} onClick={() => onChange(option)} aria-pressed={theme === option}>
          <i className={`theme-swatch is-${option}`} aria-hidden="true" />
          <span><b>{option === "garden" ? "Garden" : "Desert"}</b><small>{option === "garden" ? "Green retreat" : "Warm horizon"}</small></span>
        </button>
      ))}
    </div>
  );
}

function WeatherSimulator({
  mode,
  onSelect,
  soundEnabled,
  onToggleSound,
}: {
  mode: WeatherMode;
  onSelect: (mode: WeatherMode) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}) {
  const active = weatherPresets.find((preset) => preset.mode === mode) ?? weatherPresets[0];
  return (
    <section className={`weather-simulator is-${mode}`} id="config-step-5" aria-label="Weather automation demonstration">
      <div className="weather-head">
        <div><span>Live automation</span><h3>The weather, on your terms.</h3></div>
        <button className={soundEnabled ? "is-on" : ""} onClick={onToggleSound} aria-pressed={soundEnabled}><i>{soundEnabled ? "◖))" : "◖"}</i>{soundEnabled ? "Sound on" : "Sound off"}</button>
      </div>
      <div className="weather-presets" role="list" aria-label="Choose a weather condition">
        {weatherPresets.map((preset) => (
          <button key={preset.mode} className={mode === preset.mode ? "is-active" : ""} onClick={() => onSelect(preset.mode)} aria-pressed={mode === preset.mode}>
            <i aria-hidden="true">{preset.icon}</i><span><b>{preset.label}</b><small>{preset.note}</small></span>
          </button>
        ))}
      </div>
      <div className="weather-response" aria-live="polite"><i /><span><b>{active.label} sequence active</b><small>{active.note}. The louvers, screens and lighting update together.</small></span></div>
    </section>
  );
}

function PhotoPlanner({
  sizeIndex,
  finishIndex,
  louversOpen,
  onClose,
  onProject,
}: {
  sizeIndex: number;
  finishIndex: number;
  louversOpen: boolean;
  onClose: () => void;
  onProject: () => void;
}) {
  const [photo, setPhoto] = useState("/coordinatez-lifestyle-family.avif");
  const [photoName, setPhotoName] = useState("Coordinatez garden study");
  const [scale, setScale] = useState(68);
  const [x, setX] = useState(50);
  const [y, setY] = useState(69);
  const [rotation, setRotation] = useState(0);
  const [perspective, setPerspective] = useState(16);
  const [patioWidth, setPatioWidth] = useState(18);
  const [message, setMessage] = useState("Position the structure, then export a client-ready concept image.");
  const ownedUrl = useRef<string | null>(null);
  const configuration = sizes[sizeIndex];
  const finish = finishes[finishIndex];
  const clearance = (patioWidth - configuration.width) / 2;

  useEffect(() => () => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
  }, []);

  const uploadPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a JPG, PNG, HEIC or WebP patio photo.");
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      setMessage("That image is too large. Choose a photo below 18 MB.");
      return;
    }
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = URL.createObjectURL(file);
    ownedUrl.current = url;
    setPhoto(url);
    setPhotoName(file.name);
    setMessage("Photo loaded. Match the floor line and known patio width for a convincing scale study.");
  };

  const exportConcept = async () => {
    setMessage("Rendering the Coordinatez concept image…");
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = photo;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const cover = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const drawWidth = image.naturalWidth * cover;
      const drawHeight = image.naturalHeight * cover;
      context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
      const modelScale = (scale / 100) * 1.08;
      const roofWidth = 760 * modelScale;
      const roofDepth = Math.min(330, 210 * (configuration.depth / configuration.width)) * modelScale;
      const postHeight = 285 * modelScale;
      context.save();
      context.translate(canvas.width * x / 100, canvas.height * y / 100);
      context.rotate(rotation * Math.PI / 180);
      context.globalAlpha = 0.38;
      context.fillStyle = "#050806";
      context.beginPath();
      context.ellipse(0, 20, roofWidth * 0.62, roofDepth * 0.46, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      const inset = perspective * modelScale;
      context.fillStyle = finish.value;
      context.strokeStyle = "rgba(255,255,255,.38)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-roofWidth / 2, -postHeight);
      context.lineTo(roofWidth / 2, -postHeight);
      context.lineTo(roofWidth / 2 - inset, -postHeight + roofDepth);
      context.lineTo(-roofWidth / 2 + inset, -postHeight + roofDepth);
      context.closePath();
      context.fill();
      context.stroke();
      context.strokeStyle = "rgba(10,15,12,.68)";
      context.lineWidth = Math.max(3, 7 * modelScale);
      const louverCount = 17;
      for (let index = 1; index < louverCount; index += 1) {
        const progress = index / louverCount;
        const left = -roofWidth / 2 + inset * progress;
        const right = roofWidth / 2 - inset * progress;
        const lineY = -postHeight + roofDepth * progress;
        context.beginPath();
        context.moveTo(left, lineY);
        context.lineTo(right, lineY + (louversOpen ? 9 * modelScale : 0));
        context.stroke();
      }
      context.strokeStyle = finish.value;
      context.lineWidth = Math.max(12, 22 * modelScale);
      for (const [postX, postY] of [[-roofWidth / 2 + 8, -postHeight + 7], [roofWidth / 2 - 8, -postHeight + 7], [-roofWidth / 2 + inset + 8, -postHeight + roofDepth - 7], [roofWidth / 2 - inset - 8, -postHeight + roofDepth - 7]] as const) {
        context.beginPath();
        context.moveTo(postX, postY);
        context.lineTo(postX, 0);
        context.stroke();
      }
      context.restore();
      const shade = context.createLinearGradient(0, canvas.height - 170, 0, canvas.height);
      shade.addColorStop(0, "rgba(5,10,7,0)");
      shade.addColorStop(1, "rgba(5,10,7,.82)");
      context.fillStyle = shade;
      context.fillRect(0, canvas.height - 190, canvas.width, 190);
      context.fillStyle = "#c9ff61";
      context.font = "700 22px Arial, sans-serif";
      context.fillText("COORDINATEZ / PHOTO PATIO PLANNER", 52, 820);
      context.fillStyle = "#ffffff";
      context.font = "500 29px Arial, sans-serif";
      context.fillText(`AXIS POWER+ · ${configuration.label} · ${finish.name}`, 52, 862);
      context.textAlign = "right";
      context.font = "500 19px Arial, sans-serif";
      context.fillText("CONCEPT VISUALIZATION · VERIFY SITE DIMENSIONS", 1548, 858);
      const link = document.createElement("a");
      link.download = `coordinatez-axis-${configuration.slug}-${finish.slug}-concept.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
      setMessage("Concept image exported with the Coordinatez project mark.");
    } catch {
      setMessage("The concept image could not be exported. Try another JPG or PNG photo.");
    }
  };

  return (
    <div className="planner-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="planner-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-title">
        <header><div><span>Coordinatez spatial studio</span><h2 id="planner-title">Photo Patio Planner</h2></div><button onClick={onClose} aria-label="Close photo planner">×</button></header>
        <div className="planner-workspace">
          <div className="planner-stage">
            {/* Local object URLs must remain unoptimized so uploaded photos never leave the device. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Patio background selected for the planning study" />
            <div className="planner-floor-line" style={{ top: `${y}%` }}><span>calibrated floor line</span></div>
            <div className="planner-model" style={{ "--planner-x": `${x}%`, "--planner-y": `${y}%`, "--planner-scale": scale / 100, "--planner-rotate": `${rotation}deg`, "--planner-perspective": `${perspective}px`, "--planner-finish": finish.value } as React.CSSProperties} aria-label={`${configuration.label} pergola photo overlay`}>
              <i className="planner-shadow" /><div className="planner-roof">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div><i className="planner-post p1" /><i className="planner-post p2" /><i className="planner-post p3" /><i className="planner-post p4" /><b>COORDINATEZ</b>
            </div>
            <div className="planner-watermark">COORDINATEZ <span>CONCEPT STUDY</span></div>
          </div>
          <aside className="planner-controls">
            <div className="planner-file"><span><small>Background photo</small><b>{photoName}</b></span><label>Upload patio photo<input type="file" accept="image/*" onChange={uploadPhoto} /></label></div>
            <div className="planner-calibration"><label><span>Patio width</span><b>{patioWidth} ft</b><input type="range" min="8" max="40" step="1" value={patioWidth} onChange={(event) => setPatioWidth(Number(event.target.value))} /></label><p className={clearance < 0 ? "is-warning" : ""}>{clearance < 0 ? `AXIS exceeds the measured width by ${Math.abs(clearance * 2).toFixed(1)} ft.` : `${clearance.toFixed(1)} ft approximate clearance on each side.`}</p></div>
            {[
              ["Scale", scale, setScale, 35, 115, 1],
              ["Horizontal", x, setX, 10, 90, 1],
              ["Floor position", y, setY, 42, 92, 1],
              ["Perspective", perspective, setPerspective, -40, 60, 1],
              ["Rotation", rotation, setRotation, -18, 18, 1],
            ].map(([label, value, setter, min, max, step]) => (
              <label className="planner-slider" key={String(label)}><span>{String(label)}<b>{Number(value)}{label === "Rotation" ? "°" : ""}</b></span><input type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={Number(value)} onChange={(event) => (setter as (next: number) => void)(Number(event.target.value))} /></label>
            ))}
            <p className="planner-message" aria-live="polite">{message}</p>
            <div className="planner-actions"><button onClick={() => void exportConcept()}>Export concept image <b>↓</b></button><button onClick={onProject}>Add to project brief <b>→</b></button><a href={`${PUBLIC_DEMO_ORIGIN}/ar?size=${configuration.slug}&finish=${finish.slug}`}>Continue in AR <b>↗</b></a></div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function DesignComparison({
  current,
  saved,
  onClose,
  onLoad,
}: {
  current: SavedDesign;
  saved: SavedDesign[];
  onClose: () => void;
  onLoad: (design: SavedDesign) => void;
}) {
  const baseline = saved[0] ?? {
    id: "baseline",
    name: "Compact garden baseline",
    sizeIndex: 0,
    finishIndex: 0,
    wallSides: { ...defaultWallSelections, rear: false, left: false },
    heater: false,
    furnished: true,
    theme: "garden" as SceneTheme,
    weather: "clear" as WeatherMode,
    total: sizes[0].price + 2190,
    createdAt: "Reference",
  };
  const cards = [current, baseline];
  return (
    <div className="design-compare-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="design-compare-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-design-title">
        <header><div><span>Coordinatez design desk</span><h2 id="compare-design-title">Compare configurations</h2></div><button onClick={onClose} aria-label="Close design comparison">×</button></header>
        <div className="design-compare-grid">
          {cards.map((design, index) => (
            <article key={`${design.id}-${index}`} className={index === 0 ? "is-current" : ""}>
              <span>{index === 0 ? "Current configuration" : "Saved reference"}</span><h3>{design.name}</h3>
              <div className="design-swatch" style={{ "--design-finish": finishes[design.finishIndex].value } as React.CSSProperties}><i /><i /><i /><i /><b>AXIS</b></div>
              <dl><div><dt>Footprint</dt><dd>{sizes[design.sizeIndex].label}</dd></div><div><dt>Finish</dt><dd>{finishes[design.finishIndex].name}</dd></div><div><dt>Motorized walls</dt><dd>{selectedWallCount(design.wallSides)}</dd></div><div><dt>Furniture</dt><dd>{design.furnished ? "Lounge + BBQ" : "Open plan"}</dd></div><div><dt>Weather scene</dt><dd>{weatherPresets.find((preset) => preset.mode === design.weather)?.label}</dd></div></dl>
              <strong>{money(design.total)}</strong>{index !== 0 && <button onClick={() => onLoad(design)}>Load this design →</button>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const stormPerformanceStats = [
  { prefix: "Up to", value: "160 MPH", label: "Wind engineering" },
  { prefix: "Up to", value: "50 PSF", label: "Snow-load range" },
  { prefix: "", value: "6063-T5", label: "Aluminum frame" },
  { prefix: "", value: "IP-rated", label: "Protected power" },
];

function StormPerformanceHero() {
  const [motionActive, setMotionActive] = useState(true);

  return (
    <section className={`storm-performance ${motionActive ? "is-live" : "is-still"}`} id="storm-performance" aria-labelledby="storm-performance-title">
      <div className="storm-performance-heading reveal">
        <div><span>All-season engineering</span><h2 id="storm-performance-title">Composure, whatever the forecast.</h2></div>
        <p>A cinematic look at the AXIS engineering range—closed louvers, concealed drainage and protected power working as one system.</p>
      </div>
      <div className="storm-performance-stage reveal">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size AVIF is lazy-loaded on a Cloudflare Worker */}
        <img src="/coordinatez-storm-performance.avif" alt="Graphite Coordinatez pergola sheltering an outdoor lounge in a dramatic rainstorm" loading="lazy" decoding="async" width="1672" height="941" />
        <div className="storm-performance-vignette" aria-hidden="true" />
        <div className="storm-performance-rain" aria-hidden="true" />
        <div className="storm-performance-flash" aria-hidden="true" />

        <div className="storm-performance-topline">
          <span><i /> COORDINATEZ WEATHER LAB</span>
          <button type="button" onClick={() => setMotionActive((active) => !active)} aria-pressed={motionActive}>
            <i>{motionActive ? "Ⅱ" : "▶"}</i>{motionActive ? "Pause atmosphere" : "Play atmosphere"}
          </button>
        </div>

        <div className="storm-performance-copy">
          <span>AXIS POWER+ / STORM STUDY 01</span>
          <h3>Built for the moment<br /><em>the sky changes.</em></h3>
          <p>Warm light stays on. Water moves away. The room beneath remains unmistakably yours.</p>
          <a href="#specifications">Explore engineering <b>↗</b></a>
        </div>

        <div className="storm-performance-stats" aria-label="AXIS engineering range highlights">
          {stormPerformanceStats.map((stat) => (
            <div key={stat.label}>
              <small>{stat.prefix || "Material"}</small>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="storm-performance-note">Performance shown represents the Coordinatez AXIS range. Final ratings depend on model, anchoring and site-specific engineering.</p>
    </section>
  );
}

function ProductFilmShowcase({ onExplore }: { onExplore: () => void }) {
  const [activeFilm, setActiveFilm] = useState(0);
  const [filmPlaying, setFilmPlaying] = useState(true);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const filmRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setSectionVisible(entry.isIntersecting), { rootMargin: "180px 0px", threshold: 0.08 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const film = filmRef.current;
    if (!film) return;
    if (filmPlaying && sectionVisible) void film.play().catch(() => setFilmPlaying(false));
    else film.pause();
  }, [activeFilm, filmPlaying, sectionVisible]);

  useEffect(() => {
    if (!narrationEnabled || !filmPlaying || !sectionVisible || !("speechSynthesis" in window)) return;
    const narration = new SpeechSynthesisUtterance(prototypeFilms[activeFilm].narration);
    narration.lang = "en-US";
    narration.rate = 0.93;
    narration.pitch = 0.92;
    narration.volume = 0.88;
    const voices = window.speechSynthesis.getVoices();
    narration.voice = voices.find((voice) => voice.lang.startsWith("en") && /Samantha|Daniel|Karen|Moira/i.test(voice.name)) ?? voices.find((voice) => voice.lang.startsWith("en")) ?? null;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(narration);
    return () => window.speechSynthesis.cancel();
  }, [activeFilm, filmPlaying, narrationEnabled, sectionVisible]);

  useEffect(() => {
    if (!musicEnabled || !filmPlaying || !sectionVisible) return;
    return startAmbientScore(activeFilm);
  }, [activeFilm, filmPlaying, musicEnabled, sectionVisible]);

  return (
    <section ref={sectionRef} className="prototype-showcase product-film-section" id="films">
      <div className="prototype-heading reveal">
        <div><span>Next-level outdoor performance</span><h2>A moving product story.</h2></div>
        <p>Three short films show how AXIS changes a space through light, weather control and the moments that happen underneath.</p>
      </div>
      <div className="prototype-stage reveal">
        <video key={prototypeFilms[activeFilm].id} ref={filmRef} className="prototype-video" muted loop playsInline preload="none" poster={prototypeFilms[activeFilm].poster} aria-label={`${prototypeFilms[activeFilm].label} concept film`}>
          <source src={prototypeFilms[activeFilm].video} type="video/mp4" />
        </video>
        <div className="prototype-shade" aria-hidden="true" />
        <div className="prototype-stage-topline"><span>COORDINATEZ PRODUCT FILM</span><i>0{activeFilm + 1} / 03</i></div>
        <div className="prototype-audio-controls" aria-label="Product film audio">
          <button className={narrationEnabled ? "is-active" : ""} onClick={() => setNarrationEnabled((enabled) => !enabled)} aria-label={narrationEnabled ? "Turn narration off" : "Add narration"} aria-pressed={narrationEnabled}><i>VO</i><span>{narrationEnabled ? "Narration on" : "Add narration"}</span></button>
          <button className={musicEnabled ? "is-active" : ""} onClick={() => setMusicEnabled((enabled) => !enabled)} aria-label={musicEnabled ? "Turn music off" : "Add music"} aria-pressed={musicEnabled}><i>♫</i><span>{musicEnabled ? "Music on" : "Add music"}</span></button>
        </div>
        <div className="prototype-story" key={`product-film-${activeFilm}`}>
          <span>{prototypeFilms[activeFilm].eyebrow}</span>
          <h2>{prototypeFilms[activeFilm].title}</h2>
          <p>{prototypeFilms[activeFilm].copy}</p>
          <div><b>{prototypeFilms[activeFilm].stat}</b><button onClick={onExplore}>Configure in 3D <i>↗</i></button></div>
        </div>
        <button className="prototype-play" onClick={() => setFilmPlaying((playing) => !playing)} aria-label={filmPlaying ? "Pause product film" : "Play product film"}>
          <i>{filmPlaying ? "Ⅱ" : "▶"}</i><span>{filmPlaying ? "Pause film" : "Play film"}</span>
        </button>
        <div className="prototype-progress" aria-hidden="true"><i className={filmPlaying ? "is-playing" : ""} key={`${activeFilm}-${filmPlaying}`} /></div>
      </div>
      <div className="prototype-chapters" role="tablist" aria-label="Choose a product film">
        {prototypeFilms.map((film, index) => (
          <button key={film.id} className={activeFilm === index ? "is-active" : ""} onClick={() => { setActiveFilm(index); setFilmPlaying(true); }} role="tab" aria-selected={activeFilm === index}>
            <span className="prototype-thumb"><span style={{ backgroundImage: `url(${film.poster})` }} aria-hidden="true" /><i>{film.index}</i></span>
            <span><small>{film.eyebrow}</small><b>{film.label}</b></span><em>↗</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function AssemblyLibrary() {
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const chapter = selectedChapter === null ? null : assemblyChapters[selectedChapter];

  useEffect(() => {
    if (selectedChapter === null) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelectedChapter(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedChapter]);

  return (
    <section className="assembly-library" id="assembly">
      <div className="product-section-heading reveal"><span>Guided build library</span><h2>Assembly, one clear chapter at a time.</h2><p>Fifteen playable walkthroughs cover the complete demo installation path, from layout and anchoring to motor calibration.</p></div>
      <div className="assembly-grid">
        {assemblyChapters.map((item, index) => (
          <button className="assembly-card reveal" key={item.index} onClick={() => setSelectedChapter(index)}>
            <span className="assembly-poster" style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(4,8,6,.68)),url(${item.poster})` }}><i>▶</i><small>{item.duration}</small></span>
            <span><small>CHAPTER {item.index}</small><b>{item.title}</b></span><em>↗</em>
          </button>
        ))}
      </div>
      {chapter && (
        <div className="media-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedChapter(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${chapter.title} assembly video`}>
            <button className="media-modal-close" onClick={() => setSelectedChapter(null)} aria-label="Close assembly video">×</button>
            <video key={chapter.index} autoPlay controls playsInline poster={chapter.poster}><source src={chapter.video} type="video/mp4" /><track kind="captions" src="/assembly-captions.vtt" srcLang="en" label="English" default /></video>
            <div><span>ASSEMBLY CHAPTER {chapter.index}</span><h2>{chapter.title}</h2><p>Coordinatez guided installation prototype · {chapter.duration}</p></div>
          </section>
        </div>
      )}
    </section>
  );
}

function InstallationChecker({ onStart }: { onStart: () => void }) {
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<"idle" | "ready" | "invalid">("idle");
  return (
    <section className="installation-checker" id="installation">
      <div className="installation-copy reveal"><span>Installation service</span><h2>Check your project ZIP.</h2><p>Start with a preliminary installation fit check. A studio specialist will confirm access, surface conditions and local engineering before scheduling.</p></div>
      <form className="zip-form reveal" onSubmit={(event) => { event.preventDefault(); setResult(/^\d{5}(-\d{4})?$/.test(zip.trim()) ? "ready" : "invalid"); }}>
        <label htmlFor="install-zip">Installation ZIP code</label>
        <div><input id="install-zip" inputMode="numeric" autoComplete="postal-code" maxLength={10} value={zip} onChange={(event) => { setZip(event.target.value); setResult("idle"); }} placeholder="Enter ZIP" /><button type="submit">Check availability →</button></div>
        <p className={`zip-result is-${result}`} aria-live="polite">{result === "ready" ? "Preliminary fit confirmed. Continue to a project review for final availability." : result === "invalid" ? "Enter a valid 5-digit US ZIP code." : "No payment or commitment required."}</p>
        {result === "ready" && <button type="button" className="zip-start" onClick={onStart}>Start installation review ↗</button>}
      </form>
    </section>
  );
}

function LifestyleGallery() {
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const scene = selectedScene === null ? null : lifestyleScenes[selectedScene];
  return (
    <>
      <section className="lifestyle-gallery" id="stories">
        <div className="product-section-heading reveal"><span>Real-life inspiration</span><h2>Seven spaces. One responsive roof.</h2><p>Explore original Coordinatez concepts across poolside, garden, desert and all-weather settings.</p></div>
        <div className="lifestyle-grid">
          {lifestyleScenes.map((item, index) => (
            <button className={`lifestyle-card reveal scene-${index + 1}`} key={item.title} onClick={() => setSelectedScene(index)}>
              <span style={{ backgroundImage: `url(${item.image})` }} aria-hidden="true" /><i>{String(index + 1).padStart(2, "0")}</i><div><small>{item.location}</small><b>{item.title}</b></div>
            </button>
          ))}
        </div>
      </section>
      {scene && (
        <div className="media-modal lifestyle-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedScene(null)}>
          <section role="dialog" aria-modal="true" aria-label={scene.title}>
            <button className="media-modal-close" onClick={() => setSelectedScene(null)} aria-label="Close lifestyle scene">×</button>
            <div className="lifestyle-modal-image" style={{ backgroundImage: `url(${scene.image})` }} />
            <div><span>{scene.location}</span><h2>{scene.title}</h2></div>
          </section>
        </div>
      )}
    </>
  );
}

export function ProductStudio() {
  const [selectedSize, setSelectedSize] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(0);
  const [louversOpen, setLouversOpen] = useState(false);
  const [yardVisible, setYardVisible] = useState(true);
  const [dusk, setDusk] = useState(false);
  const [theme, setTheme] = useState<SceneTheme>("garden");
  const [heater, setHeater] = useState(false);
  const [furnished, setFurnished] = useState(true);
  const [wallSides, setWallSides] = useState<WallSelections>({ ...defaultWallSelections });
  const [weatherMode, setWeatherMode] = useState<WeatherMode>("clear");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [configStep, setConfigStep] = useState(0);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [compareDesignsOpen, setCompareDesignsOpen] = useState(false);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [toolMessage, setToolMessage] = useState("");
  const [pdfState, setPdfState] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState<BriefForm>(emptyBrief);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [reference, setReference] = useState("");
  const [accountName, setAccountName] = useState("");

  const total = useMemo(
    () => sizes[selectedSize].price + (heater ? 798 : 0) + selectedWallCount(wallSides) * 1190,
    [heater, selectedSize, wallSides],
  );

  const currentDesign = useMemo<SavedDesign>(() => ({
    id: "current",
    name: `${sizes[selectedSize].label} ${finishes[selectedFinish].name} study`,
    sizeIndex: selectedSize,
    finishIndex: selectedFinish,
    wallSides: { ...wallSides },
    heater,
    furnished,
    theme,
    weather: weatherMode,
    total,
    createdAt: new Date().toISOString(),
  }), [furnished, heater, selectedFinish, selectedSize, theme, total, wallSides, weatherMode]);

  const playFeedback = (kind: MechanismSound) => {
    if (soundEnabled) playMechanismSound(kind);
  };

  const toggleWallSide = (side: WallSide) => {
    playFeedback("wall");
    setWallSides((current) => ({ ...current, [side]: !current[side] }));
    setWeatherMode("clear");
  };

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

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem("coordinatez-saved-designs") ?? "[]") as SavedDesign[];
        if (Array.isArray(stored)) setSavedDesigns(stored.slice(0, 6));
      } catch {
        window.localStorage.removeItem("coordinatez-saved-designs");
      }

      const query = new URLSearchParams(window.location.search);
      const sizeIndex = sizes.findIndex((size) => size.slug === query.get("size"));
      const finishIndex = finishes.findIndex((finish) => finish.slug === query.get("finish"));
      if (sizeIndex >= 0) setSelectedSize(sizeIndex);
      if (finishIndex >= 0) setSelectedFinish(finishIndex);
      const queryTheme = query.get("theme");
      if (queryTheme === "garden" || queryTheme === "desert") setTheme(queryTheme);
      const queryWeather = query.get("weather");
      if (weatherPresets.some((preset) => preset.mode === queryWeather)) {
        setWeatherMode(queryWeather as WeatherMode);
        setYardVisible(true);
        if (queryWeather === "clear") { setLouversOpen(true); setDusk(false); setWallSides({ front: false, rear: false, left: false, right: false }); }
        else if (queryWeather === "sun") { setLouversOpen(false); setDusk(false); setWallSides({ front: false, rear: false, left: false, right: false }); }
        else if (queryWeather === "rain") { setLouversOpen(false); setDusk(false); setWallSides({ front: false, rear: true, left: true, right: false }); }
        else if (queryWeather === "evening") { setLouversOpen(true); setDusk(true); setWallSides({ front: false, rear: true, left: false, right: false }); }
        else { setLouversOpen(false); setDusk(false); setWallSides({ front: false, rear: false, left: false, right: false }); }
      }
      if (query.has("heater")) setHeater(query.get("heater") === "1");
      if (query.has("furnished")) setFurnished(query.get("furnished") !== "0");
      const queryWalls = query.get("walls");
      if (queryWalls !== null) {
        const selected = new Set(queryWalls.split(","));
        setWallSides({ front: selected.has("front"), rear: selected.has("rear"), left: selected.has("left"), right: selected.has("right") });
      }
    });
  }, []);

  useEffect(() => {
    if (window.location.hostname.endsWith("github.io")) return;
    void fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ user?: { name?: string } | null }> : null)
      .then((result) => setAccountName(result?.user?.name?.split(/\s+/)[0] ?? ""))
      .catch(() => undefined);
  }, []);

  const goToConfigStep = (step: number) => {
    const next = Math.max(0, Math.min(configurationSteps.length - 1, step));
    setConfigStep(next);
    document.getElementById(`config-step-${next}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const applyWeatherPreset = (mode: WeatherMode) => {
    setWeatherMode(mode);
    setYardVisible(true);
    if (mode === "clear") {
      setLouversOpen(true);
      setDusk(false);
      setWallSides({ front: false, rear: false, left: false, right: false });
    } else if (mode === "sun") {
      setLouversOpen(false);
      setDusk(false);
      setWallSides({ front: false, rear: false, left: false, right: false });
    } else if (mode === "rain") {
      setLouversOpen(false);
      setDusk(false);
      setWallSides({ front: false, rear: true, left: true, right: false });
    } else if (mode === "evening") {
      setLouversOpen(true);
      setDusk(true);
      setWallSides({ front: false, rear: true, left: false, right: false });
    } else {
      setLouversOpen(false);
      setDusk(false);
      setWallSides({ front: false, rear: false, left: false, right: false });
    }
    playFeedback(mode === "rain" ? "wall" : "louvers");
  };

  const saveCurrentDesign = async () => {
    const saved = { ...currentDesign, id: `axis-${Date.now()}`, createdAt: new Date().toISOString() };
    const next = [saved, ...savedDesigns].slice(0, 6);
    setSavedDesigns(next);
    window.localStorage.setItem("coordinatez-saved-designs", JSON.stringify(next));
    if (window.location.hostname.endsWith("github.io")) {
      setToolMessage("Design saved on this device. Sign in on the live demo to add cloud backup.");
      return;
    }
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saved.name, configuration: saved }),
      });
      if (response.ok) {
        setToolMessage("Design saved to your Coordinatez account and this device.");
        return;
      }
      if (response.status === 401) {
        setToolMessage("Design saved on this device. Sign in to sync it across devices.");
        return;
      }
      throw new Error("Cloud save unavailable");
    } catch {
      setToolMessage("Design saved on this device. Cloud sync will be available when the account service reconnects.");
    }
  };

  const loadSavedDesign = (design: SavedDesign) => {
    setSelectedSize(design.sizeIndex);
    setSelectedFinish(design.finishIndex);
    setHeater(design.heater);
    setFurnished(design.furnished);
    setTheme(design.theme);
    applyWeatherPreset(design.weather);
    setWallSides({ ...design.wallSides });
    setCompareDesignsOpen(false);
    setToolMessage(`${design.name} loaded into the live studio.`);
    document.getElementById("configure")?.scrollIntoView({ behavior: "smooth" });
  };

  const shareCurrentDesign = async () => {
    const query = new URLSearchParams({
      size: sizes[selectedSize].slug,
      finish: finishes[selectedFinish].slug,
      walls: wallSideOptions.filter(({ side }) => wallSides[side]).map(({ side }) => side).join(","),
      heater: heater ? "1" : "0",
      furnished: furnished ? "1" : "0",
      theme,
      weather: weatherMode,
    });
    const url = `${PUBLIC_DEMO_ORIGIN}/?${query.toString()}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else if (navigator.share) await navigator.share({ title: "Coordinatez AXIS configuration", text: `${sizes[selectedSize].label} · ${finishes[selectedFinish].name} · ${money(total)}`, url });
      else throw new Error("Sharing is unavailable");
      setToolMessage("Share link ready. It preserves every selected option.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setToolMessage("Copy the current page URL to share this configuration.");
    }
  };

  const exportProjectPdf = async () => {
    setPdfState("working");
    setToolMessage("Building the Coordinatez project package…");
    try {
      const { jsPDF } = await import("jspdf");
      const document = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const cleanSize = sizes[selectedSize].label.replaceAll("′", " ft").replace("×", "x");
      document.setFillColor(12, 18, 14);
      document.rect(0, 0, 612, 154, "F");
      document.setFillColor(201, 255, 97);
      document.rect(42, 35, 7, 68, "F");
      document.setTextColor(201, 255, 97);
      document.setFont("helvetica", "bold");
      document.setFontSize(13);
      document.text("COORDINATEZ / PROJECT STUDIO", 66, 54);
      document.setTextColor(255, 255, 255);
      document.setFontSize(30);
      document.text("AXIS POWER+", 66, 91);
      document.setFontSize(12);
      document.setFont("helvetica", "normal");
      document.text(`${cleanSize} / ${finishes[selectedFinish].name} / ${money(total)}`, 66, 117);
      document.setTextColor(20, 29, 24);
      document.setFont("helvetica", "bold");
      document.setFontSize(17);
      document.text("Configured system", 42, 196);
      const rows = [
        ["Footprint", cleanSize],
        ["Finish", finishes[selectedFinish].name],
        ["Motorized walls", wallSideOptions.filter(({ side }) => wallSides[side]).map(({ label }) => label).join(", ") || "None"],
        ["Furniture plan", furnished ? "L-shape lounge, table and barbecue" : "Open plan"],
        ["Radiant heaters", heater ? "Dual 1500W package" : "Not selected"],
        ["Environment", theme === "garden" ? "Garden retreat" : "Desert horizon"],
        ["Weather scene", weatherPresets.find((preset) => preset.mode === weatherMode)?.label ?? "Clear"],
        ["Configured estimate", money(total)],
      ];
      let rowY = 224;
      document.setFontSize(10);
      for (const [label, value] of rows) {
        document.setDrawColor(216, 222, 217);
        document.line(42, rowY + 20, 570, rowY + 20);
        document.setFont("helvetica", "normal");
        document.setTextColor(103, 116, 107);
        document.text(label.toUpperCase(), 42, rowY + 12);
        document.setFont("helvetica", "bold");
        document.setTextColor(20, 29, 24);
        document.text(value, 220, rowY + 12, { maxWidth: 348 });
        rowY += 34;
      }
      document.setFillColor(239, 242, 237);
      document.roundedRect(42, 514, 528, 128, 7, 7, "F");
      document.setTextColor(20, 29, 24);
      document.setFont("helvetica", "bold");
      document.setFontSize(15);
      document.text("Installation and clearance review", 62, 548);
      document.setFont("helvetica", "normal");
      document.setFontSize(10);
      document.text("Confirm substrate, anchoring, drainage, electrical routing and local engineering before ordering. Use the live AR model to verify the full-size footprint on the intended patio.", 62, 572, { maxWidth: 336, lineHeightFactor: 1.45 });
      const qrSource = `/ar/coordinatez-ar-qr-${sizes[selectedSize].slug}-${finishes[selectedFinish].slug}.png`;
      const qrResponse = await fetch(qrSource);
      if (qrResponse.ok) {
        const qrBlob = await qrResponse.blob();
        const qrData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(qrBlob); });
        document.addImage(qrData, "PNG", 446, 529, 94, 94);
      }
      document.setFontSize(8);
      document.setTextColor(91, 104, 96);
      document.text("SCAN FOR TRUE-SCALE AR", 446, 633);
      document.setFillColor(12, 18, 14);
      document.rect(0, 696, 612, 96, "F");
      document.setTextColor(255, 255, 255);
      document.setFontSize(10);
      document.text("COORDINATEZ AXIS / CONCEPT CONFIGURATION", 42, 730);
      document.setTextColor(201, 255, 97);
      document.text(`${PUBLIC_DEMO_ORIGIN}/ar`, 42, 754);
      document.setTextColor(173, 185, 176);
      document.text("Concept estimate. Final specification requires a verified site review.", 570, 754, { align: "right" });
      document.save(`coordinatez-axis-${sizes[selectedSize].slug}-${finishes[selectedFinish].slug}.pdf`);
      setPdfState("ready");
      setToolMessage("Branded project PDF downloaded with configuration, specifications and AR QR code.");
    } catch {
      setPdfState("error");
      setToolMessage("The PDF could not be generated in this browser. Try Chrome, Safari or Edge.");
    }
  };

  const addToBrief = () => {
    setSubmitState("idle");
    setSubmitMessage("");
    setBriefOpen(true);
  };

  useEffect(() => {
    if (!briefOpen && !plannerOpen && !compareDesignsOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setBriefOpen(false);
      setPlannerOpen(false);
      setCompareDesignsOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [briefOpen, compareDesignsOpen, plannerOpen]);

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
            privacyScreen: selectedWallCount(wallSides) > 0,
            wallSides: wallSideOptions.filter(({ side }) => wallSides[side]).map(({ label }) => label),
            environmentTheme: theme,
            furniturePlan: furnished ? "L-shape lounge, table and barbecue" : "Open plan",
            weatherScene: weatherMode,
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
          <a href="#configure" onClick={() => setMenuOpen(false)}>Product</a>
          <a href="#films" onClick={() => setMenuOpen(false)}>Performance</a>
          <a href="#assembly" onClick={() => setMenuOpen(false)}>Assembly</a>
          <a href="#compare" onClick={() => setMenuOpen(false)}>Compare</a>
          <a href="#showrooms" onClick={() => setMenuOpen(false)}>Showrooms</a>
        </nav>
        <div className="header-actions">
          <a className="account-link" href={`${PUBLIC_DEMO_ORIGIN}/account`}>{accountName || "Account"}<i>↗</i></a>
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
              sizeIndex={selectedSize}
              wallSides={wallSides}
              theme={theme}
              furnished={furnished}
            />
            <div className="viewer-controls" aria-label="3D model controls">
              <Toggle active={louversOpen} onChange={() => { playFeedback("louvers"); setLouversOpen(!louversOpen); setWeatherMode("clear"); }} label="Open louvers" />
              <Toggle active={yardVisible} onChange={() => setYardVisible(!yardVisible)} label="Show landscape" />
              <Toggle active={dusk} onChange={() => { setDusk(!dusk); setWeatherMode(!dusk ? "evening" : "clear"); }} label="Evening light" />
            </div>
            <WeatherSimulator mode={weatherMode} onSelect={applyWeatherPreset} soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled((enabled) => !enabled)} />
          </div>

          <div className="configurator">
            <div className="eyebrow-row">
              <span>Coordinatez Gen 2 outdoor system</span>
              <span>POWER+ platform</span>
            </div>
            <h1>AXIS POWER+<span>™</span> Gen 2 Motorized Pergola</h1>
            <div className="rating-row">
              <span className="stars">★★★★★</span>
              <a href="#stories">4.9 / 70 concept reviews</a>
            </div>
            <div className="price-line">From {money(sizes[selectedSize].price)}</div>
            <p className="lead-copy">A flexible motorized pergola for real backyards, with expanded footprints, connected control and all-season aluminum engineering.</p>
            <ul className="feature-list">
              <li><span>01</span> Motorized 0–120° aluminum louvers</li>
              <li><span>02</span> 80 MPH wind · 20 PSF snow rating</li>
              <li><span>03</span> Integrated power, drainage and LED light</li>
            </ul>

            <div className="product-overview-links" aria-label="Product information">
              <a href="#specifications">Pergola sizes & technical information <b>↓</b></a>
              <a href="#assembly">Assembly videos <b>↓</b></a>
              <a href="#compare">Compare to others <b>↓</b></a>
            </div>

            <div className="configuration-path" aria-label="Guided configuration steps">
              <div><span>Guided design path</span><b>{String(configStep + 1).padStart(2, "0")} / {String(configurationSteps.length).padStart(2, "0")}</b></div>
              <div>{configurationSteps.map((step, index) => <button key={step} className={configStep === index ? "is-active" : configStep > index ? "is-complete" : ""} onClick={() => goToConfigStep(index)}><i>{configStep > index ? "✓" : index + 1}</i><span>{step}</span></button>)}</div>
            </div>

            <div className="option-group">
              <div className="option-heading"><span>Layout</span><b>Freestanding</b></div>
              <button className="layout-option is-selected">
                <span className="layout-glyph"><i /><i /><i /><i /></span>
                <span><b>Freestanding</b><small>Four-post structural frame</small></span>
                <em>✓</em>
              </button>
            </div>

            <div className={`option-group guided-option ${configStep === 0 ? "is-active" : ""}`} id="config-step-0">
              <div className="option-heading"><span>01 / Footprint</span><button onClick={() => setPlannerOpen(true)}>Check against a patio photo ↗</button></div>
              <div className="size-grid">
                {sizes.map((size, index) => (
                  <button
                    key={size.label}
                    className={selectedSize === index ? "is-selected" : ""}
                    onClick={() => { setSelectedSize(index); setConfigStep(1); }}
                  >
                    <b>{size.label}</b><small>{size.meta} · {size.width} × {size.depth} ft</small>
                  </button>
                ))}
              </div>
            </div>

            <div className={`option-group guided-option ${configStep === 1 ? "is-active" : ""}`} id="config-step-1">
              <div className="option-heading"><span>02 / Finish</span><b>{finishes[selectedFinish].name}</b></div>
              <div className="finish-options">
                {finishes.map((finish, index) => (
                  <button
                    key={finish.name}
                    className={selectedFinish === index ? "is-selected" : ""}
                    onClick={() => { setSelectedFinish(index); setConfigStep(2); }}
                    aria-label={`Select ${finish.name} finish`}
                  >
                    <i style={{ background: finish.value }} />
                    <span>{finish.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={`option-group guided-option ${configStep === 2 ? "is-active" : ""}`} id="config-step-2">
              <div className="option-heading"><span>03 / Motorized screens</span><b>{selectedWallCount(wallSides)} selected</b></div>
              <div className="wall-configurator">
                <div><span><b>Choose any side</b><small>Each elevation moves independently</small></span><strong>+ $1,190 each</strong></div>
                <WallSidePicker walls={wallSides} onChange={(side) => { toggleWallSide(side); setConfigStep(3); }} />
              </div>
            </div>

            <div className={`option-group guided-option ${configStep === 3 ? "is-active" : ""}`} id="config-step-3">
              <div className="option-heading"><span>04 / Comfort</span><b>Furniture + heat</b></div>
              <label className="addon">
                <input type="checkbox" checked={furnished} onChange={(event) => { setFurnished(event.target.checked); setConfigStep(4); }} />
                <span className="checkmark" />
                <span><b>L-shape lounge + barbecue</b><small>Full-scale spatial planning set</small></span>
                <strong>Included</strong>
              </label>
              <label className="addon">
                <input type="checkbox" checked={heater} onChange={(event) => { setHeater(event.target.checked); setConfigStep(4); }} />
                <span className="checkmark" />
                <span><b>Dual radiant heaters</b><small>2 × 1500W · graphite</small></span>
                <strong>+ $798</strong>
              </label>
            </div>

            <div className={`option-group guided-option ${configStep === 4 ? "is-active" : ""}`} id="config-step-4">
              <div className="option-heading"><span>05 / Environment</span><b>{theme === "garden" ? "Garden" : "Desert"}</b></div>
              <ThemePicker theme={theme} onChange={(nextTheme) => { setTheme(nextTheme); setConfigStep(5); }} />
            </div>

            <div className={`purchase-block guided-option ${configStep === 6 ? "is-active" : ""}`} id="config-step-6">
              <div><span>Configured total</span><strong>{money(total)}</strong></div>
              <button onClick={addToBrief}>Add to project brief <span>→</span></button>
              <p><i /> Your configuration is attached automatically.</p>
              <div className="project-tool-grid" aria-label="Project planning tools">
                <button onClick={() => setPlannerOpen(true)}><i>▧</i><span><b>Photo planner</b><small>Place AXIS into a patio photo</small></span></button>
                <button onClick={() => void saveCurrentDesign()}><i>＋</i><span><b>Save design</b><small>{accountName ? `${savedDesigns.length} local · cloud active` : `${savedDesigns.length} local · sign in for cloud`}</small></span></button>
                <button onClick={() => void shareCurrentDesign()}><i>↗</i><span><b>Share link</b><small>Preserves every option</small></span></button>
                <button onClick={() => setCompareDesignsOpen(true)}><i>Ⅱ</i><span><b>Compare designs</b><small>Current versus saved</small></span></button>
                <button onClick={() => void exportProjectPdf()} disabled={pdfState === "working"}><i>PDF</i><span><b>{pdfState === "working" ? "Building PDF…" : "Project PDF"}</b><small>Specs, estimate and AR QR</small></span></button>
                <a href={`${PUBLIC_DEMO_ORIGIN}/ar?size=${sizes[selectedSize].slug}&finish=${finishes[selectedFinish].slug}`}><i>AR</i><span><b>View in your space</b><small>True-scale phone placement</small></span></a>
              </div>
              <p className="project-tool-message" aria-live="polite">{toolMessage || "Save, compare, share or export this exact configuration."}</p>
            </div>
          </div>
        </section>

        <section className="order-benefits" aria-label="Order benefits">
          <article><i>✓</i><span><b>Delivery guarantee</b><small>Protected arrival commitment</small></span></article>
          <article><i>⌂</i><span><b>Free home delivery</b><small>Delivered to your address</small></span></article>
          <article><i>100</i><span><b>100-day free trial</b><small>Live with AXIS risk-free</small></span></article>
          <article><i>10</i><span><b>10-year warranty</b><small>Long-term structural cover</small></span></article>
        </section>

        <section className="signal-strip" aria-label="Product highlights">
          <span>120° LOUVER MOTION</span><i>✦</i><span>CONCEALED DRAINAGE</span><i>✦</i><span>SMART WEATHER CONTROL</span><i>✦</i><span>10-YEAR STRUCTURAL COVER</span>
        </section>

        <ProductFilmShowcase onExplore={() => document.querySelector("#configure")?.scrollIntoView({ behavior: "smooth" })} />

        <StormPerformanceHero />

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
            <span>0°</span><span>120°</span>
          </div>
          <div className="performance-grid">
            {featureCards.map((card) => (
              <article key={card.index} className="feature-card reveal">
                <span>{card.index}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
                <a href="#specifications">Explore detail <b>↗</b></a>
              </article>
            ))}
          </div>
        </section>

        <section className="numbers-section reveal">
          <div><strong>12 sec</strong><span>Open to closed</span></div>
          <div><strong>80 mph</strong><span>Wind resistance</span></div>
          <div><strong>20 psf</strong><span>Snow load</span></div>
          <div><strong>10 yr</strong><span>Frame coverage</span></div>
        </section>

        <section className="feature-story is-light" id="power">
          <div className="feature-story-media reveal" style={{ backgroundImage: "url(/coordinatez-film-control.avif)" }}><span>01 / CONNECTED CONTROL</span></div>
          <div className="feature-story-copy reveal"><span>Integrated outdoor power</span><h2>One system. App, remote and power at every post.</h2><p>Prewired beams keep the installation composed. Control the roof and lighting from a handheld remote or mobile experience, with weather-protected outlets placed where the room needs them.</p><ul><li>IP-rated post outlets</li><li>Integrated perimeter LEDs</li><li>App + remote louver control</li></ul></div>
        </section>

        <section className="feature-story is-dark is-reversed">
          <div className="feature-story-media reveal" style={{ backgroundImage: "url(/coordinatez-lifestyle-rain.avif)" }}><span>02 / ALL-SEASON SHELTER</span></div>
          <div className="feature-story-copy reveal"><span>Stronger and tougher</span><h2>Rain moves out. Comfort stays in.</h2><p>Interlocking louvers close into a continuous roof while concealed gutters carry water through separated drainage channels inside the posts.</p><ul><li>6063-T5 aluminum construction</li><li>Water and electrical separation</li><li>60% faster drainage concept</li></ul></div>
        </section>

        <section className="feature-story is-light">
          <div className="feature-story-media reveal" style={{ backgroundImage: "url(/coordinatez-lifestyle-family.avif)" }}><span>03 / FLEXIBLE ROOM</span></div>
          <div className="feature-story-copy reveal"><span>Transform with motorized walls</span><h2>Privacy and protection, side by side.</h2><p>Choose each elevation independently in the live configurator. Screens lower only where needed, preserving the open-air character of the room.</p><ul><li>Front, rear, left or right</li><li>Independent motorized movement</li><li>Furniture-scale spatial preview</li></ul></div>
        </section>

        <section className="specifications-section" id="specifications">
          <div className="product-section-heading reveal"><span>Pergola sizes & technical information</span><h2>Everything specified.</h2><p>The selected 3D footprint updates the core dimensional record below.</p></div>
          <div className="specification-layout">
            <div className="size-blueprints reveal" aria-label="Available pergola sizes">
              {sizes.map((size, index) => <button key={size.label} className={selectedSize === index ? "is-active" : ""} onClick={() => setSelectedSize(index)}><i><span /><span /><span /><span /></i><b>{size.label}</b><small>{size.meta}</small></button>)}
            </div>
            <dl className="spec-table reveal">
              {[
                ["Model", "AXIS POWER+ Gen 2"],
                ["Finish", finishes[selectedFinish].name],
                ["Pergola size", sizes[selectedSize].label],
                ["Post system", selectedSize === 3 ? "6-post extended" : "4-post standard"],
                ["Overall height", "8′ 2″"],
                ["Frame material", "6063-T5 aluminum"],
                ["Water protection", "IP67 roof / IP-rated power"],
                ["Wind resistance", "80 MPH"],
                ["Snow load", "20 PSF"],
                ["Louver range", "0–120° motorized"],
                ["Drainage", "Concealed dual-direction"],
                ["Controls", "App + RF remote"],
              ].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
            </dl>
          </div>
        </section>

        <section className="competitor-section" id="compare">
          <div className="product-section-heading reveal"><span>Coordinatez vs others</span><h2>Compare the complete system.</h2><p>One responsive table—clear on desktop, horizontally scrollable on mobile, and never duplicated.</p></div>
          <div className="competitor-scroll reveal">
            <div className="competitor-table">
              <div className="competitor-head"><span>Feature</span><b>AXIS POWER+ Gen 2<small>Coordinatez</small></b><b>Premium kit A<small>Market reference</small></b><b>Premium kit B<small>Market reference</small></b><b>Custom build<small>Traditional</small></b></div>
              {competitorRows.map((row) => <div className="competitor-row" key={row[0]}>{row.map((cell, index) => index === 0 ? <strong key={cell}>{cell}</strong> : <span className={index === 1 ? "is-axis" : ""} key={`${row[0]}-${index}`}>{cell}{index === 1 && <i>✓</i>}</span>)}</div>)}
            </div>
          </div>
        </section>

        <AssemblyLibrary />
        <InstallationChecker onStart={addToBrief} />

        <section className="assurance-section" id="warranty">
          <article className="reveal"><span>100</span><div><small>100-day free trial</small><h2>Make sure the room feels right.</h2><p>Experience the structure through a complete season of everyday use with a clear demo trial promise.</p></div></article>
          <article className="reveal"><span>10</span><div><small>10-year warranty</small><h2>Built for the long outside.</h2><p>Structural coverage protects the core frame while documented components keep ongoing service straightforward.</p></div></article>
        </section>

        <LifestyleGallery />

        <section className="showroom-gallery" id="showrooms">
          <div className="product-section-heading reveal"><span>Coordinatez experience spaces</span><h2>See AXIS at full scale.</h2><p>Four showroom concepts demonstrate louver movement, side screens, lighting and furniture-scale planning.</p></div>
          <div className="showroom-track">
            {showroomScenes.map((showroom, index) => <article className="showroom-card reveal" key={showroom.city}><div style={{ backgroundImage: `url(${showroom.image})` }}><span>0{index + 1}</span></div><small>{showroom.note}</small><h3>{showroom.city}</h3><button onClick={addToBrief}>Plan a visit ↗</button></article>)}
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
        <div><b>Product</b><a href="#configure">3D configurator</a><a href="#specifications">Specifications</a><a href="#compare">Compare systems</a></div>
        <div><b>Support</b><a href="#assembly">Assembly library</a><a href="#installation">Installation check</a><a href="#warranty">Trial & warranty</a></div>
        <div className="footer-note"><p>A complete Coordinatez AXIS product demonstration for planning a responsive outdoor room.</p><span>© 2026 Coordinatez Demo</span></div>
      </footer>

      {plannerOpen && <PhotoPlanner sizeIndex={selectedSize} finishIndex={selectedFinish} louversOpen={louversOpen} onClose={() => setPlannerOpen(false)} onProject={() => { setPlannerOpen(false); addToBrief(); }} />}

      {compareDesignsOpen && <DesignComparison current={currentDesign} saved={savedDesigns} onClose={() => setCompareDesignsOpen(false)} onLoad={loadSavedDesign} />}

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
                  <h2 id="brief-title">Bring us<br />{" "}your outside.</h2>
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

const prototypeFilms = [
  {
    id: "living",
    index: "01",
    label: "Outdoor living",
    eyebrow: "AXIS / Evening mode",
    title: "Made for the hours you keep.",
    copy: "A long L-sectional, warm perimeter light and open-air cooking turn the pergola into a room that stays inviting after sunset.",
    stat: "One continuous outdoor room",
    narration: "AXIS turns the patio into one continuous outdoor room. Open the louvers for the last light of day, then bring up the perimeter glow as the evening begins.",
    video: "/coordinatez-film-living.mp4",
    poster: "/coordinatez-film-living.avif",
  },
  {
    id: "control",
    index: "02",
    label: "Smart control",
    eyebrow: "AXIS / Connected control",
    title: "The weather, on your terms.",
    copy: "Move the louvers, lower any privacy wall and tune the evening light from a single, deliberately simple control experience.",
    stat: "Remote + mobile control",
    narration: "Connected control keeps every movement simple. Adjust the louvers, privacy walls, and evening lighting from one deliberate interface.",
    video: "/coordinatez-film-control.mp4",
    poster: "/coordinatez-film-control.avif",
  },
  {
    id: "louvers",
    index: "03",
    label: "Louver motion",
    eyebrow: "AXIS / Daylight study",
    title: "Shade when you need it. Sky when you want it.",
    copy: "Precision louvers rotate through the sun path, opening the room to air and sealing into a clean shelter when conditions change.",
    stat: "0–120° adjustable louvers",
    narration: "Precision louvers rotate through one hundred and twenty degrees. Shape the shade, welcome open sky, or close the roof when the weather changes.",
    video: "/coordinatez-film-louvers.mp4",
    poster: "/coordinatez-film-louvers.avif",
  },
];

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

export function ModelRangeLanding() {
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState<RangeModel>(modelRanges[0].models[0]);
  const [studioOpen, setStudioOpen] = useState(false);
  const [louversOpen, setLouversOpen] = useState(false);
  const [yardVisible, setYardVisible] = useState(true);
  const [dusk, setDusk] = useState(false);
  const [theme, setTheme] = useState<SceneTheme>("garden");
  const [wallSides, setWallSides] = useState<WallSelections>({ ...defaultWallSelections });
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
  const [activeFilm, setActiveFilm] = useState(0);
  const [filmPlaying, setFilmPlaying] = useState(true);
  const [trayCount, setTrayCount] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const filmRef = useRef<HTMLVideoElement>(null);

  const sizePremiums = [0, 900, 2400, 6600];
  const total = selectedModel.basePrice + sizePremiums[selectedSize] + selectedWallCount(wallSides) * 1190;
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
    const film = filmRef.current;
    if (!film) return;
    if (filmPlaying) void film.play().catch(() => setFilmPlaying(false));
    else film.pause();
  }, [activeFilm, filmPlaying]);

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
    setTheme("garden");
    setWallSides({ ...defaultWallSelections });
    setStudioOpen(true);
  };

  const toggleWallSide = (side: WallSide) => {
    playMechanismSound("wall");
    setWallSides((current) => ({ ...current, [side]: !current[side] }));
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
            privacyScreen: selectedWallCount(wallSides) > 0,
            wallSides: wallSideOptions.filter(({ side }) => wallSides[side]).map(({ label }) => label),
            environmentTheme: theme,
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
          <a href="#films" onClick={() => setMenuOpen(false)}>Films</a>
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

        <section className="prototype-showcase" id="films">
          <div className="prototype-heading range-reveal is-visible">
            <div><span>Three ways to live with AXIS</span><h2>A moving product story.</h2></div>
            <p>Original Coordinatez concept films pair the product system with the moments it is designed to make possible.</p>
          </div>
          <div className="prototype-stage">
            <video
              key={prototypeFilms[activeFilm].id}
              ref={filmRef}
              className="prototype-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={prototypeFilms[activeFilm].poster}
              aria-label={`${prototypeFilms[activeFilm].label} concept film`}
            >
              <source src={prototypeFilms[activeFilm].video} type="video/mp4" />
            </video>
            <div className="prototype-shade" aria-hidden="true" />
            <div className="prototype-stage-topline"><span>COORDINATEZ PRODUCT FILM</span><i>0{activeFilm + 1} / 03</i></div>
            <div className="prototype-story" key={`story-${activeFilm}`}>
              <span>{prototypeFilms[activeFilm].eyebrow}</span>
              <h2>{prototypeFilms[activeFilm].title}</h2>
              <p>{prototypeFilms[activeFilm].copy}</p>
              <div><b>{prototypeFilms[activeFilm].stat}</b><button onClick={() => openModel(modelRanges[0].models[1])}>Explore in 3D <i>↗</i></button></div>
            </div>
            <button
              className="prototype-play"
              onClick={() => setFilmPlaying((playing) => !playing)}
              aria-label={filmPlaying ? "Pause product film" : "Play product film"}
            >
              <i>{filmPlaying ? "Ⅱ" : "▶"}</i><span>{filmPlaying ? "Pause film" : "Play film"}</span>
            </button>
            <div className="prototype-progress" aria-hidden="true"><i className={filmPlaying ? "is-playing" : ""} key={`${activeFilm}-${filmPlaying}`} /></div>
          </div>
          <div className="prototype-chapters" role="tablist" aria-label="Choose a product film">
            {prototypeFilms.map((film, index) => (
              <button
                key={film.id}
                className={activeFilm === index ? "is-active" : ""}
                onClick={() => { setActiveFilm(index); setFilmPlaying(true); }}
                role="tab"
                aria-selected={activeFilm === index}
              >
                <span className="prototype-thumb"><span style={{ backgroundImage: `url(${film.poster})` }} aria-hidden="true" /><i>{film.index}</i></span>
                <span><small>{film.eyebrow}</small><b>{film.label}</b></span>
                <em>↗</em>
              </button>
            ))}
          </div>
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
              <RealPergolaViewer finish={finishes[selectedFinish].value} louversOpen={louversOpen} yardVisible={yardVisible} dusk={dusk} sizeIndex={selectedSize} wallSides={wallSides} theme={theme} />
              <div className="viewer-controls" aria-label="3D model controls">
                <Toggle active={louversOpen} onChange={() => { playMechanismSound("louvers"); setLouversOpen(!louversOpen); }} label="Open louvers" />
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
              <div className="studio-option"><div><span>Environment</span><b>{theme === "garden" ? "Garden" : "Desert"}</b></div><ThemePicker theme={theme} onChange={setTheme} /></div>
              <div className="studio-option"><div><span>Motorized walls</span><b>{selectedWallCount(wallSides)} selected</b></div><WallSidePicker walls={wallSides} onChange={toggleWallSide} /></div>
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
                <div className="brief-intro"><span>Start your project</span><h2 id="brief-title">Bring us<br />{" "}your outside.</h2><p>Share a few details and the complete model configuration will arrive with your request.</p></div>
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

export default function Home() {
  return <ProductStudio />;
}
