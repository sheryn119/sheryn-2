import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// ─── Renderer ────────────────────────────────────────────────────────────────
const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

// ─── Scene & Camera ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  48,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);
camera.position.set(0, 8, 18);
camera.lookAt(0, 0, 0);

// ─── Lighting ────────────────────────────────────────────────────────────────
// Ambient keeps everything visible, directional gives the cubes visual depth
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const dirA = new THREE.DirectionalLight(0xffffff, 0.9);
dirA.position.set(3, 6, 8);
scene.add(dirA);

const dirB = new THREE.DirectionalLight(0x8888ff, 0.25);
dirB.position.set(-5, -2, 4);
scene.add(dirB);

// ─── Triangular Grid ─────────────────────────────────────────────────────────
// Row k  →  k + 1 cubes  (k = 0 … N)
// Apex is at row 0 (single cube → "perspective centre").
// Outer rows fan outward and contain progressively more cubes.
const N = 42;
const SPACING = 0.46;
const ROW_H = Math.sqrt(3) * 0.5 * SPACING; // vertical distance between rows

const positions = [];
for (let row = 0; row <= N; row++) {
  for (let col = 0; col <= row; col++) {
    positions.push({
      // equilateral-triangle lattice
      x: (col - row * 0.5) * SPACING,
      y: row * ROW_H,
      row,
    });
  }
}

// Centre grid so the apex is above the origin and the base below
const midY = (N * ROW_H) * 0.5;

// Per-cube constants ──────────────────────────────────────────────────────────
const COUNT = positions.length;

// Phase encodes how far each cube is from the apex.
// Using (row / N) * CRESTS full cycles means CRESTS wave-fronts are visible
// simultaneously across the grid at any given moment.
const CRESTS = 3.5;
const phases = new Float32Array(COUNT);

// Amplitude: cubes near the apex barely move; outer cubes protrude dramatically.
const amplitudes = new Float32Array(COUNT);

// Scale: cubes also grow slightly toward the outer edge.
const baseScales = new Float32Array(COUNT);

for (let i = 0; i < COUNT; i++) {
  const t = positions[i].row / N; // 0 at apex → 1 at base
  phases[i] = t * CRESTS * Math.PI * 2;
  amplitudes[i] = 0.18 + t * 2.1;
  baseScales[i] = 0.36 + t * 0.64;
}

// ─── Instanced Cube Mesh ─────────────────────────────────────────────────────
const cubeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const cubeMat = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 });
const mesh = new THREE.InstancedMesh(cubeGeo, cubeMat, COUNT);
mesh.frustumCulled = false;

// Tilt the whole group to create the perspective / vanishing-point illusion:
//   rotation.x pulls the grid plane toward the viewer (we look at it obliquely)
//   rotation.z rotates it diagonally so the apex faces toward the upper-right
const group = new THREE.Group();
group.rotation.x = -0.62;
group.rotation.z = 0.80;
scene.add(group);
group.add(mesh);

const dummy = new THREE.Object3D();

// ─── Star Field ──────────────────────────────────────────────────────────────
// Two layers of points: a large set of small stars + a smaller set of big stars.
// Sharing one position buffer (different draw ranges) avoids redundant updates.
const N_STARS = 560;
const N_BIG = 80; // last N_BIG entries are the "big" stars

const starPosArr = new Float32Array(N_STARS * 3);
const starBaseArr = new Float32Array(N_STARS * 3);
const starPhaseArr = new Float32Array(N_STARS * 2);

for (let i = 0; i < N_STARS; i++) {
  const x = (Math.random() - 0.5) * 60;
  const y = (Math.random() - 0.5) * 36;
  const z = -22 - Math.random() * 14;
  starBaseArr[i * 3] = starPosArr[i * 3] = x;
  starBaseArr[i * 3 + 1] = starPosArr[i * 3 + 1] = y;
  starBaseArr[i * 3 + 2] = starPosArr[i * 3 + 2] = z;
  starPhaseArr[i * 2] = Math.random() * Math.PI * 2;
  starPhaseArr[i * 2 + 1] = Math.random() * Math.PI * 2;
}

// Small stars
const starGeoSmall = new THREE.BufferGeometry();
const smallBuf = new THREE.BufferAttribute(starPosArr, 3);
starGeoSmall.setAttribute("position", smallBuf);
starGeoSmall.setDrawRange(0, N_STARS - N_BIG);
const starMatSmall = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.055,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
scene.add(new THREE.Points(starGeoSmall, starMatSmall));

// Large (brighter) stars — same buffer, different draw range
const starGeoBig = new THREE.BufferGeometry();
const bigBuf = new THREE.BufferAttribute(starPosArr, 3); // same typed array
starGeoBig.setAttribute("position", bigBuf);
starGeoBig.setDrawRange(N_STARS - N_BIG, N_BIG);
const starMatBig = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.16,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.30,
  depthWrite: false,
});
scene.add(new THREE.Points(starGeoBig, starMatBig));

// ─── Animation Loop ──────────────────────────────────────────────────────────
// Loop duration chosen so the animation is seamless:
//   phi = t * 2π,  t ∈ [0, 1)
//   sin(phi − phases[i]) is 2π-periodic in phi → perfect loop regardless of
//   the constant phases[i].
const LOOP_DUR = 4.0; // seconds

function animate(ms) {
  const t = (ms * 0.001 % LOOP_DUR) / LOOP_DUR;
  const phi = t * Math.PI * 2; // 0 → 2π, then wraps perfectly

  // ── Cubes ────────────────────────────────────────────────────────────────
  for (let i = 0; i < COUNT; i++) {
    const { x, y } = positions[i];

    // Wave travels outward from apex (small phases) toward base (large phases).
    // "phi − phases[i]" means the crest sweeps from row 0 toward row N as
    // phi advances, producing the "radiating outward" appearance.
    const z = Math.sin(phi - phases[i]) * amplitudes[i];

    dummy.position.set(x, y - midY, z);
    dummy.scale.setScalar(baseScales[i]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  // ── Stars ─────────────────────────────────────────────────────────────────
  // Gentle drifting motion; fully periodic so it loops cleanly.
  for (let i = 0; i < N_STARS; i++) {
    starPosArr[i * 3] =
      starBaseArr[i * 3] + Math.cos(phi + starPhaseArr[i * 2]) * 0.28;
    starPosArr[i * 3 + 1] =
      starBaseArr[i * 3 + 1] + Math.sin(phi + starPhaseArr[i * 2 + 1]) * 0.17;
  }
  smallBuf.needsUpdate = true;
  bigBuf.needsUpdate = true;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// ─── Resize Handler ──────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
