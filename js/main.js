/* Ride Hero — Three.js night-drive particle scene + GSAP scroll choreography */
import * as THREE from "three";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reducedMotion) document.documentElement.classList.add("reduced");

/* ================= THREE.JS SCENE ================= */
/* A glowing "city grid" of particles with streaking light trails
   (headlights/taillights) flowing toward the camera. Scroll drives
   the camera through the scene. */

const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07080f, 0.016);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 2.2, 14);

/* --- City particle field (instanced points) --- */
const CITY_COUNT = reducedMotion ? 1500 : 4200;
const cityGeo = new THREE.BufferGeometry();
const pos = new Float32Array(CITY_COUNT * 3);
const col = new Float32Array(CITY_COUNT * 3);
const cCyan = new THREE.Color(0x67e8f9);
const cViolet = new THREE.Color(0xa78bfa);
const cWhite = new THREE.Color(0xdfe3ff);
const tmp = new THREE.Color();

for (let i = 0; i < CITY_COUNT; i++) {
  // Two "skylines" flanking a central road corridor
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = side * (4 + Math.random() * 26);
  const y = Math.random() * Math.random() * 14;
  const z = -Math.random() * 220;
  pos.set([x, y, z], i * 3);

  const r = Math.random();
  tmp.copy(r < 0.45 ? cCyan : r < 0.8 ? cViolet : cWhite);
  tmp.multiplyScalar(0.55 + Math.random() * 0.45);
  col.set([tmp.r, tmp.g, tmp.b], i * 3);
}
cityGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
cityGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));

const cityMat = new THREE.PointsMaterial({
  size: 0.14,
  vertexColors: true,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const city = new THREE.Points(cityGeo, cityMat);
scene.add(city);

/* --- Light trails: long thin boxes streaming toward camera --- */
const TRAIL_COUNT = reducedMotion ? 0 : 90;
const trailGeo = new THREE.BoxGeometry(0.035, 0.035, 3.2);
const trailMatCyan = new THREE.MeshBasicMaterial({
  color: 0x67e8f9, transparent: true, opacity: 0.7,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const trailMatRed = new THREE.MeshBasicMaterial({
  color: 0xff5e7a, transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const trails = new THREE.InstancedMesh(trailGeo, trailMatCyan, TRAIL_COUNT);
const trailsRed = new THREE.InstancedMesh(trailGeo, trailMatRed, TRAIL_COUNT);
const dummy = new THREE.Object3D();
const trailData = [];

function seedTrail(i, mesh, dir) {
  const lane = (Math.random() * 2.6 + 0.6) * (dir > 0 ? -1 : 1); // oncoming left, outgoing right
  const d = {
    x: lane,
    y: 0.06 + Math.random() * 0.1,
    z: -Math.random() * 220,
    speed: (14 + Math.random() * 30) * dir,
  };
  trailData.push({ ...d, mesh, i });
}
if (!reducedMotion) {
  for (let i = 0; i < TRAIL_COUNT; i++) seedTrail(i, trails, 1);
  for (let i = 0; i < TRAIL_COUNT; i++) seedTrail(i, trailsRed, -1);
  scene.add(trails, trailsRed);
}

/* --- Road grid lines --- */
const gridGeo = new THREE.BufferGeometry();
const gridPts = [];
for (let i = 0; i <= 30; i++) {
  const z = -i * 8;
  gridPts.push(-40, 0, z, 40, 0, z);
}
for (let i = -8; i <= 8; i++) {
  gridPts.push(i * 5, 0, 4, i * 5, 0, -240);
}
gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));
const grid = new THREE.LineSegments(
  gridGeo,
  new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.07 })
);
scene.add(grid);

/* --- Central glowing orb (destination beacon) --- */
const beacon = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending })
);
beacon.position.set(0, 3, -120);
scene.add(beacon);

/* --- Scroll + pointer driven camera --- */
let scrollProgress = 0; // 0..1 across full page
let pointerX = 0, pointerY = 0;
let targetPX = 0, targetPY = 0;

window.addEventListener("pointermove", (e) => {
  targetPX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetPY = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

function updateScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener("scroll", updateScroll, { passive: true });

/* --- Render loop (paused when tab hidden) --- */
const clock = new THREE.Clock();
let running = true;
document.addEventListener("visibilitychange", () => {
  running = !document.hidden;
  if (running) { clock.getDelta(); render(); }
});

function render() {
  if (!running) return;
  requestAnimationFrame(render);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Camera travels down the corridor as the user scrolls
  const travel = scrollProgress * 90;
  pointerX += (targetPX - pointerX) * 0.04;
  pointerY += (targetPY - pointerY) * 0.04;
  camera.position.z = 14 - travel;
  camera.position.x = pointerX * 1.4 + Math.sin(t * 0.18) * 0.5;
  camera.position.y = 2.2 - pointerY * 0.8 + Math.sin(t * 0.24) * 0.25;
  camera.lookAt(pointerX * 2, 1.6, camera.position.z - 20);

  // Recycle city particles behind the camera to keep the field infinite
  const p = cityGeo.attributes.position.array;
  for (let i = 0; i < CITY_COUNT; i++) {
    if (p[i * 3 + 2] > camera.position.z + 6) p[i * 3 + 2] -= 220;
  }
  cityGeo.attributes.position.needsUpdate = true;

  // Animate light trails
  for (const d of trailData) {
    d.z += d.speed * dt;
    if (d.speed > 0 && d.z > camera.position.z + 8) d.z -= 230;
    if (d.speed < 0 && d.z < camera.position.z - 230) d.z += 230;
    dummy.position.set(d.x, d.y, d.z);
    dummy.updateMatrix();
    d.mesh.setMatrixAt(d.i, dummy.matrix);
  }
  if (trailData.length) {
    trails.instanceMatrix.needsUpdate = true;
    trailsRed.instanceMatrix.needsUpdate = true;
  }

  // Beacon pulses and stays ahead of the camera
  beacon.position.z = camera.position.z - 120;
  const s = 1 + Math.sin(t * 1.6) * 0.15;
  beacon.scale.setScalar(s);

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateScroll();
render();

/* ================= GSAP SCROLL CHOREOGRAPHY ================= */
gsap.registerPlugin(ScrollTrigger);

/* Loader */
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
loaderFill.style.width = "70%";
window.addEventListener("load", () => {
  loaderFill.style.width = "100%";
  setTimeout(() => {
    loader.classList.add("done");
    introTimeline();
  }, 450);
});
// Fallback if `load` already fired or hangs
setTimeout(() => {
  if (!loader.classList.contains("done")) {
    loader.classList.add("done");
    introTimeline();
  }
}, 3000);

/* Hero intro */
let introPlayed = false;
function introTimeline() {
  if (introPlayed) return;
  introPlayed = true;
  if (reducedMotion) {
    gsap.set(".hero .reveal, .hero .line > span", { opacity: 1, y: 0 });
    return;
  }
  gsap.set(".hero .line > span", { yPercent: 110 });
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.to(".hero .line > span", { yPercent: 0, duration: 1.2, stagger: 0.12 }, 0.1)
    .to(".hero__eyebrow", { opacity: 1, y: 0, duration: 0.8 }, 0.3)
    .to(".hero__sub", { opacity: 1, y: 0, duration: 0.9 }, 0.55)
    .to(".hero__cta", { opacity: 1, y: 0, duration: 0.9 }, 0.7)
    .to(".hero__stats", { opacity: 1, y: 0, duration: 0.9, onComplete: countUp }, 0.85);
}

/* Animated stat counters */
function countUp() {
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const decimals = String(el.dataset.count).includes(".") ? 1 : 0;
    gsap.fromTo(el, { innerText: 0 }, {
      innerText: end,
      duration: 1.6,
      ease: "power2.out",
      snap: decimals ? false : { innerText: 1 },
      onUpdate() {
        el.innerText = parseFloat(el.innerText).toFixed(decimals);
      },
    });
  });
}

if (!reducedMotion) {
  /* Generic reveals (outside hero — hero handled by intro) */
  gsap.utils.toArray(".reveal").forEach((el) => {
    if (el.closest(".hero")) return;
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 86%" },
    });
  });

  /* Visual section: words illuminate as you scroll */
  gsap.utils.toArray(".vw").forEach((w, i) => {
    gsap.to(w, {
      opacity: 1, duration: 0.6, ease: "none",
      scrollTrigger: {
        trigger: ".visual__sticky",
        start: `top+=${i * 8}% 60%`,
        end: `top+=${i * 8 + 14}% 40%`,
        scrub: true,
      },
    });
  });

  /* Visual cards: parallax on desktop, simple reveal on mobile */
  const isMobile = window.innerWidth < 768;
  gsap.utils.toArray(".vcard").forEach((card) => {
    const speed = parseFloat(card.dataset.speed || 1);
    if (isMobile) {
      gsap.fromTo(card,
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: card, start: "top 88%" },
        }
      );
    } else {
      gsap.fromTo(card,
        { y: 120 * speed, opacity: 0 },
        {
          y: -60 * (speed - 0.7), opacity: 1, ease: "none",
          scrollTrigger: { trigger: ".visual__cards", start: "top 95%", end: "bottom 30%", scrub: 1 },
        }
      );
    }
  });

  /* Feature cards stagger in */
  gsap.fromTo(".fcard",
    { y: 60, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: "power3.out",
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".features__grid", start: "top 82%", once: true },
    }
  );

  /* How-it-works: numbers slide, lines draw */
  gsap.utils.toArray(".step").forEach((step, i) => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: step, start: "top 84%" },
      defaults: { ease: "power3.out" },
    });
    tl.from(step.querySelector(".step__num"), { x: -40, opacity: 0, duration: 0.8, delay: i * 0.12 })
      .from(step.querySelector(".step__line"), { scaleX: 0, duration: 0.7 }, "-=0.4")
      .from([step.querySelector("h3"), step.querySelector("p")], { y: 24, opacity: 0, stagger: 0.1, duration: 0.6 }, "-=0.4");
  });

  /* Safety shield draws itself */
  const shieldPath = document.querySelector(".shield-path");
  const shieldCheck = document.querySelector(".shield-check");
  if (shieldPath && shieldCheck) {
    const len1 = shieldPath.getTotalLength();
    const len2 = shieldCheck.getTotalLength();
    gsap.set(shieldPath, { strokeDasharray: len1, strokeDashoffset: len1 });
    gsap.set(shieldCheck, { strokeDasharray: len2, strokeDashoffset: len2 });
    gsap.timeline({
      scrollTrigger: { trigger: ".safety__shield", start: "top 78%" },
    })
      .to(shieldPath, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" })
      .to(shieldCheck, { strokeDashoffset: 0, duration: 0.8, ease: "power2.out" }, "-=0.5");
  }

  /* Testimonials drift in alternately */
  gsap.utils.toArray(".quote").forEach((q, i) => {
    gsap.from(q, {
      y: 80, opacity: 0, rotate: i % 2 ? 1.5 : -1.5, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: q, start: "top 88%" },
    });
  });

  /* Final title mask reveal */
  gsap.set(".final .line > span", { yPercent: 110 });
  gsap.to(".final .line > span", {
    yPercent: 0, duration: 1.1, stagger: 0.12, ease: "power4.out",
    scrollTrigger: { trigger: ".final", start: "top 65%" },
  });
} else {
  gsap.set(".reveal, .final .line > span, .vw", { opacity: 1, y: 0, yPercent: 0 });
}

/* Nav background on scroll */
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });
