import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import QRCode from "qrcode";

class NodeFileReader {
  result = null;
  error = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.({ target: this });
    }).catch((error) => {
      this.error = error;
      this.onerror?.(error);
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.({ target: this });
    }).catch((error) => {
      this.error = error;
      this.onerror?.(error);
    });
  }
}

globalThis.FileReader ??= NodeFileReader;

const outputDirectory = path.join(process.cwd(), "public", "ar");
await mkdir(outputDirectory, { recursive: true });

const sizes = [
  { slug: "10x10", label: "10′ × 10′", width: 3.048, depth: 3.048, posts: 4 },
  { slug: "10x13", label: "10′ × 13′", width: 3.048, depth: 3.962, posts: 4 },
  { slug: "13x13", label: "13′ × 13′", width: 3.962, depth: 3.962, posts: 4 },
  { slug: "13x20", label: "13′ × 20′", width: 3.962, depth: 6.096, posts: 6 },
];

const finishes = [
  { slug: "carbon", label: "Carbon", color: 0x414946 },
  { slug: "cloud", label: "Cloud", color: 0xd5d8d3 },
  { slug: "sand", label: "Sand", color: 0xa78d67 },
];

function buildPergola(size, finish) {
  const scene = new THREE.Scene();
  scene.name = `Coordinatez AXIS POWER+ ${size.label} ${finish.label}`;
  const root = new THREE.Group();
  root.name = "AXIS_POWER_PLUS";
  scene.add(root);

  const aluminum = new THREE.MeshStandardMaterial({ name: `${finish.label} aluminum`, color: finish.color, metalness: 0.5, roughness: 0.4 });
  const darkMetal = new THREE.MeshStandardMaterial({ name: "Graphite hardware", color: 0x161b19, metalness: 0.58, roughness: 0.38 });
  const fastener = new THREE.MeshStandardMaterial({ name: "Stainless fasteners", color: 0x929996, metalness: 0.92, roughness: 0.18 });
  const screen = new THREE.MeshStandardMaterial({ name: "Motorized mesh", color: 0x34413b, transparent: true, opacity: 0.34, depthWrite: false, roughness: 1 });
  const upholstery = new THREE.MeshStandardMaterial({ name: "Warm upholstery", color: 0xded8c8, metalness: 0, roughness: 0.86 });
  const cushionAccent = new THREE.MeshStandardMaterial({ name: "Moss cushions", color: 0x63756b, metalness: 0, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ name: "Teak accent", color: 0x8f6848, metalness: 0, roughness: 0.68 });
  const counter = new THREE.MeshStandardMaterial({ name: "Stone counter", color: 0xc7c4b8, metalness: 0.04, roughness: 0.34 });
  const light = new THREE.MeshStandardMaterial({ name: "Perimeter light", color: 0xffedcf, emissive: 0xffc16b, emissiveIntensity: 1.8, roughness: 0.25 });

  const box = (name, dimensions, position, material, parent = root) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const cylinder = (name, radius, height, position, material, parent = root) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const height = 2.49;
  const beamHeight = 0.24;
  const postSize = 0.14;
  const beamDepth = 0.19;
  const halfWidth = size.width / 2;
  const halfDepth = size.depth / 2;
  const postX = halfWidth - postSize / 2;
  const postZ = halfDepth - postSize / 2;
  const postDepths = size.posts === 6 ? [-postZ, 0, postZ] : [-postZ, postZ];

  for (const x of [-postX, postX]) {
    for (const z of postDepths) {
      box("Anchor plate", [0.29, 0.025, 0.29], [x, 0.0125, z], darkMetal);
      box("Structural post", [postSize, height - beamHeight, postSize], [x, (height - beamHeight) / 2, z], aluminum);
      for (const dx of [-0.1, 0.1]) {
        for (const dz of [-0.1, 0.1]) cylinder("Anchor bolt", 0.014, 0.035, [x + dx, 0.035, z + dz], fastener);
      }
    }
  }

  box("Front motor beam", [size.width, beamHeight, beamDepth], [0, height - beamHeight / 2, halfDepth - beamDepth / 2], aluminum);
  box("Rear drainage beam", [size.width, beamHeight, beamDepth], [0, height - beamHeight / 2, -halfDepth + beamDepth / 2], aluminum);
  box("Left beam", [beamDepth, beamHeight, size.depth], [-halfWidth + beamDepth / 2, height - beamHeight / 2, 0], aluminum);
  box("Right beam", [beamDepth, beamHeight, size.depth], [halfWidth - beamDepth / 2, height - beamHeight / 2, 0], aluminum);
  box("Motor housing", [0.25, 0.19, 0.52], [halfWidth - 0.125, height - 0.15, -halfDepth + 0.46], darkMetal);

  const innerDepth = size.depth - beamDepth * 2;
  const innerWidth = size.width - beamDepth * 2;
  const louverCount = Math.max(18, Math.round(innerDepth / 0.125));
  const spacing = innerDepth / louverCount;
  for (let index = 0; index < louverCount; index += 1) {
    const z = -innerDepth / 2 + spacing * (index + 0.5);
    box(`Louver ${String(index + 1).padStart(2, "0")}`, [innerWidth, 0.035, spacing * 0.82], [0, height - 0.17, z], aluminum);
  }

  box("Front LED", [innerWidth, 0.018, 0.025], [0, height - 0.26, halfDepth - beamDepth], light);
  box("Rear LED", [innerWidth, 0.018, 0.025], [0, height - 0.26, -halfDepth + beamDepth], light);
  box("Left LED", [0.025, 0.018, innerDepth], [-halfWidth + beamDepth, height - 0.26, 0], light);
  box("Right LED", [0.025, 0.018, innerDepth], [halfWidth - beamDepth, height - 0.26, 0], light);

  box("Rear motorized wall", [innerWidth, 1.96, 0.012], [0, 1.18, -halfDepth + 0.12], screen);
  box("Rear wall cassette", [innerWidth, 0.14, 0.15], [0, height - 0.33, -halfDepth + 0.12], aluminum);
  box("Rear wall bottom rail", [innerWidth, 0.055, 0.055], [0, 0.19, -halfDepth + 0.12], aluminum);
  for (const x of [-halfWidth + 0.23, halfWidth - 0.23]) box("Rear wall guide", [0.045, 2.02, 0.045], [x, 1.18, -halfDepth + 0.12], darkMetal);
  box("Left motorized wall", [0.012, 1.96, innerDepth], [-halfWidth + 0.12, 1.18, 0], screen);
  box("Left wall cassette", [0.15, 0.14, innerDepth], [-halfWidth + 0.12, height - 0.33, 0], aluminum);
  box("Left wall bottom rail", [0.055, 0.055, innerDepth], [-halfWidth + 0.12, 0.19, 0], aluminum);
  for (const z of [-halfDepth + 0.23, halfDepth - 0.23]) box("Left wall guide", [0.045, 2.02, 0.045], [-halfWidth + 0.12, 1.18, z], darkMetal);

  const furniture = new THREE.Group();
  furniture.name = "Outdoor furniture";
  root.add(furniture);
  const sofaWidth = Math.min(2.42, size.width * 0.68);
  const sofaZ = -halfDepth + 0.5;
  box("Sofa base", [sofaWidth, 0.16, 0.62], [-0.24, 0.28, sofaZ], darkMetal, furniture);
  box("Sofa seat", [sofaWidth - 0.12, 0.16, 0.5], [-0.24, 0.45, sofaZ + 0.03], upholstery, furniture);
  box("Sofa back", [sofaWidth - 0.08, 0.56, 0.14], [-0.24, 0.73, sofaZ - 0.23], upholstery, furniture);
  box("Chaise base", [0.62, 0.16, 1.28], [-sofaWidth / 2 + 0.07, 0.28, sofaZ + 0.34], darkMetal, furniture);
  box("Chaise cushion", [0.52, 0.18, 1.16], [-sofaWidth / 2 + 0.07, 0.46, sofaZ + 0.35], upholstery, furniture);
  box("Accent pillow left", [0.38, 0.38, 0.13], [-sofaWidth / 2 + 0.28, 0.78, sofaZ - 0.12], cushionAccent, furniture);
  box("Accent pillow right", [0.38, 0.38, 0.13], [sofaWidth / 2 - 0.72, 0.78, sofaZ - 0.12], cushionAccent, furniture);
  box("Coffee table top", [0.95, 0.08, 0.52], [0.14, 0.34, 0.22], wood, furniture);
  for (const x of [-0.31, 0.59]) for (const z of [0.03, 0.41]) box("Coffee table leg", [0.045, 0.3, 0.045], [x, 0.16, z], darkMetal, furniture);

  const barbecueX = halfWidth - 0.48;
  const barbecueZ = halfDepth - 0.43;
  box("BBQ cabinet", [0.72, 0.68, 0.48], [barbecueX, 0.38, barbecueZ], darkMetal, furniture);
  box("BBQ counter", [0.84, 0.08, 0.56], [barbecueX, 0.76, barbecueZ], counter, furniture);
  box("BBQ hood", [0.65, 0.32, 0.38], [barbecueX, 0.98, barbecueZ - 0.03], darkMetal, furniture);
  for (const dx of [-0.18, 0, 0.18]) {
    const knob = cylinder("BBQ control", 0.035, 0.035, [barbecueX + dx, 0.68, barbecueZ + 0.26], fastener, furniture);
    knob.rotation.x = Math.PI / 2;
  }

  root.traverse((object) => {
    if (!object.isMesh) return;
    object.matrixAutoUpdate = true;
  });
  scene.updateMatrixWorld(true);
  return scene;
}

const gltfExporter = new GLTFExporter();
const usdzExporter = new USDZExporter();
const manifest = [];

for (const size of sizes) {
  for (const finish of finishes) {
    const scene = buildPergola(size, finish);
    const basename = `coordinatez-axis-${size.slug}-${finish.slug}`;
    const glb = await gltfExporter.parseAsync(scene, { binary: true, onlyVisible: true });
    await writeFile(path.join(outputDirectory, `${basename}.glb`), Buffer.from(glb));
    const usdz = await usdzExporter.parseAsync(scene, { quickLookCompatible: true });
    await writeFile(path.join(outputDirectory, `${basename}.usdz`), Buffer.from(usdz));
    manifest.push({ size: size.slug, sizeLabel: size.label, finish: finish.slug, finishLabel: finish.label, glb: `/ar/${basename}.glb`, usdz: `/ar/${basename}.usdz` });
    await QRCode.toFile(
      path.join(outputDirectory, `coordinatez-ar-qr-${size.slug}-${finish.slug}.png`),
      `https://coordinatez-axis-demo.ozaparth055.workers.dev/ar?size=${size.slug}&finish=${finish.slug}`,
      {
        width: 720,
        margin: 2,
        color: { dark: "#101412", light: "#f6f5f0" },
        errorCorrectionLevel: "H",
      },
    );
  }
}

await writeFile(path.join(outputDirectory, "models.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await QRCode.toFile(path.join(outputDirectory, "coordinatez-ar-qr.png"), "https://coordinatez-axis-demo.ozaparth055.workers.dev/ar", {
  width: 720,
  margin: 2,
  color: { dark: "#101412", light: "#f6f5f0" },
  errorCorrectionLevel: "H",
});

console.log(`Generated ${manifest.length} GLB/USDZ AR model pairs and the phone handoff QR code.`);
