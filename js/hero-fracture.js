/* ==========================================================================
   Hero fracture effect — isolated WebGL layer for the hero background only.

   Concept: the dark #1c1c1c surface is described as an unbroken Voronoi
   field. A low-resolution "damage" texture accumulates directional,
   velocity-scaled impact energy from the pointer (ping-ponged between two
   render targets, decaying every frame). The main shader only reveals
   Voronoi cell-edge cracks where damage is present, blending
   surface -> #141414 (inner depth) -> #c6ff00 (revealed layer). Nothing
   here is a circular mask: visibility follows irregular cell edges, and
   the damage stamp itself is an elongated, direction-aligned ellipse
   distorted by the underlying noise-driven cell field.

   This file touches nothing outside the hero. It mounts onto
   #hero-fracture-canvas (inside #top) and reads pointer position from
   #top. If WebGL is unavailable or the user prefers reduced motion, it
   exits early and the existing solid #1c1c1c hero background is left
   completely untouched.
   ========================================================================== */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const FRACTURE_CONFIG = {
  surfaceColor: '#1c1c1c',
  depthColor: '#141414',
  accentColor: '#c6ff00',

  cellDensity: 9.0,          // Voronoi cells across the hero width
  crackWidthMin: 0.02,       // hairline width at low damage
  crackWidthMax: 0.10,       // fully opened crack width at high damage
  fragmentDisplacement: 0.012, // per-cell UV shift at full damage (subtle parallax)

  stampRadius: 0.10,         // base impact footprint (normalized, ~fraction of hero width)
  elongation: 1.6,           // how much the stamp stretches along velocity direction
  velocityMultiplier: 14.0,  // pointer speed -> energy scaling
  energyBuildRate: 0.22,     // how quickly repeated passes build up damage
  recoverySpeed: 2.4,        // seconds for damage to decay back to ~0
  mouseSmoothing: 8.0,       // higher = snappier tracking, lower = laggier

  edgeGlow: 0.4,             // restrained rim-light strength along open cracks
  maxPixelRatio: 1.6,
  damageResolution: 256      // ping-pong buffer size (independent of screen res)
};

function hexToVec3(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

function init() {
  const canvas = document.getElementById('hero-fracture-canvas');
  const hero = document.getElementById('top');
  if (!canvas || !hero) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // leave the existing static #1c1c1c hero exactly as-is

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('Hero fracture: WebGL unavailable, leaving static hero background.', err);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, FRACTURE_CONFIG.maxPixelRatio));
  renderer.setClearColor(0x000000, 0);

  /* ---------------- fullscreen-pass helper ---------------- */
  function makePass(fragmentShader, uniforms) {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader,
      depthTest: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return { scene, camera, material };
  }

  /* ---------------- damage ping-pong render targets ---------------- */
  const RES = FRACTURE_CONFIG.damageResolution;
  const rtOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false
  };
  let rtA = new THREE.WebGLRenderTarget(RES, RES, rtOptions);
  let rtB = new THREE.WebGLRenderTarget(RES, RES, rtOptions);

  /* ---------------- pass 1: damage accumulation + decay ---------------- */
  const damagePass = makePass(`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPrev;
    uniform vec2 uMouse;
    uniform vec2 uDir;
    uniform float uEnergy;
    uniform float uDecay;
    uniform float uRadius;
    uniform float uElongate;
    uniform float uBuildRate;

    void main(){
      float prev = texture2D(uPrev, vUv).r;
      prev *= uDecay;

      vec2 d = vUv - uMouse;
      vec2 dir = length(uDir) > 0.0001 ? normalize(uDir) : vec2(1.0, 0.0);
      vec2 perp = vec2(-dir.y, dir.x);
      float along = dot(d, dir);
      float across = dot(d, perp);
      float rx = uRadius * (1.0 + uElongate);
      float ry = uRadius;
      float dist = sqrt((along * along) / (rx * rx) + (across * across) / (ry * ry));
      float stamp = smoothstep(1.0, 0.0, dist) * uEnergy;

      float result = max(prev, stamp);
      result = clamp(result + stamp * uBuildRate, 0.0, 1.0);
      gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
    }
  `, {
    uPrev: { value: null },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uDir: { value: new THREE.Vector2(1, 0) },
    uEnergy: { value: 0 },
    uDecay: { value: 1 },
    uRadius: { value: FRACTURE_CONFIG.stampRadius },
    uElongate: { value: FRACTURE_CONFIG.elongation },
    uBuildRate: { value: FRACTURE_CONFIG.energyBuildRate }
  });

  /* ---------------- pass 2: visible fracture render ---------------- */
  const mainPass = makePass(`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uDamage;
    uniform vec2 uResolution;
    uniform float uCellDensity;
    uniform float uCrackMin;
    uniform float uCrackMax;
    uniform float uDisplace;
    uniform float uEdgeGlow;
    uniform vec3 uSurfaceColor;
    uniform vec3 uDepthColor;
    uniform vec3 uAccentColor;

    vec2 hash2(vec2 p){
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
    }

    // returns (F1, F2, cellIdHash)
    vec3 voronoi(vec2 x){
      vec2 n = floor(x);
      vec2 f = fract(x);
      float f1 = 8.0;
      float f2 = 8.0;
      vec2 idCell = vec2(0.0);
      for (int j = -1; j <= 1; j++){
        for (int i = -1; i <= 1; i++){
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g) * 0.5 + 0.5;
          vec2 r = g + o - f;
          float d = dot(r, r);
          if (d < f1){ f2 = f1; f1 = d; idCell = n + g; }
          else if (d < f2){ f2 = d; }
        }
      }
      float idHash = fract(sin(dot(idCell, vec2(41.3, 289.1))) * 43758.5453);
      return vec3(sqrt(f1), sqrt(f2), idHash);
    }

    void main(){
      vec2 uv = vUv;
      uv.x *= uResolution.x / uResolution.y;

      float damage = texture2D(uDamage, vUv).r;

      vec3 v0 = voronoi(uv * uCellDensity);
      vec2 cellDir = hash2(vec2(v0.z, v0.z * 1.37));
      vec2 displaced = uv + cellDir * uDisplace * damage;
      vec3 v = voronoi(displaced * uCellDensity);

      float edge = v.y - v.x;
      float crackWidth = mix(uCrackMin, uCrackMax, damage);
      float crackMask = 1.0 - smoothstep(0.0, crackWidth, edge);
      crackMask *= smoothstep(0.03, 0.55, damage);

      float facet = 0.5 + 0.5 * cellDir.x;
      vec3 surface = mix(uSurfaceColor, uSurfaceColor * (0.9 + facet * 0.12), damage * 0.6);

      vec3 crackInner = mix(uDepthColor, uAccentColor, smoothstep(0.35, 1.0, damage));
      vec3 color = mix(surface, crackInner, crackMask);

      float rim = crackMask * smoothstep(0.5, 1.0, damage) * uEdgeGlow;
      color += uAccentColor * rim * 0.5;

      gl_FragColor = vec4(color, 1.0);
    }
  `, {
    uDamage: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCellDensity: { value: FRACTURE_CONFIG.cellDensity },
    uCrackMin: { value: FRACTURE_CONFIG.crackWidthMin },
    uCrackMax: { value: FRACTURE_CONFIG.crackWidthMax },
    uDisplace: { value: FRACTURE_CONFIG.fragmentDisplacement },
    uEdgeGlow: { value: FRACTURE_CONFIG.edgeGlow },
    uSurfaceColor: { value: hexToVec3(FRACTURE_CONFIG.surfaceColor) },
    uDepthColor: { value: hexToVec3(FRACTURE_CONFIG.depthColor) },
    uAccentColor: { value: hexToVec3(FRACTURE_CONFIG.accentColor) }
  });

  /* ---------------- pointer input state (updated only in the event handler) ---------------- */
  const rawMouse = new THREE.Vector2(0.5, 0.5);
  const smoothedMouse = new THREE.Vector2(0.5, 0.5);
  const prevSmoothedMouse = new THREE.Vector2(0.5, 0.5);
  let pointerActive = false;

  function updatePointer(clientX, clientY) {
    const rect = hero.getBoundingClientRect();
    rawMouse.x = (clientX - rect.left) / rect.width;
    rawMouse.y = 1.0 - (clientY - rect.top) / rect.height; // flip to match shader UV space
    pointerActive = true;
  }

  hero.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('pointerdown', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('pointerleave', () => { pointerActive = false; }, { passive: true });
  // Intentionally no preventDefault anywhere — normal page scroll/touch stays untouched.

  /* ---------------- sizing ---------------- */
  function resize() {
    const rect = hero.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    mainPass.material.uniforms.uResolution.value.set(w, h);
  }
  resize();

  let ro;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(resize);
    ro.observe(hero);
  } else {
    window.addEventListener('resize', resize);
  }

  /* ---------------- visibility gating (pause work when hidden) ---------------- */
  let heroVisible = true;
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver((entries) => {
      heroVisible = entries[0]?.isIntersecting ?? true;
    }, { threshold: 0 });
    io.observe(hero);
  }
  let tabVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; });

  /* ---------------- render loop ---------------- */
  let lastTime = performance.now();
  let rafId;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!heroVisible || !tabVisible) return;

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const smoothAlpha = 1 - Math.exp(-dt * FRACTURE_CONFIG.mouseSmoothing);
    prevSmoothedMouse.copy(smoothedMouse);
    smoothedMouse.lerp(rawMouse, smoothAlpha);

    const velocity = new THREE.Vector2().subVectors(smoothedMouse, prevSmoothedMouse).divideScalar(Math.max(dt, 0.0001));
    const speed = velocity.length();
    const energy = pointerActive ? Math.min(speed * FRACTURE_CONFIG.velocityMultiplier * dt, 1.0) : 0.0;
    const dir = speed > 0.0001 ? velocity.clone().normalize() : new THREE.Vector2(1, 0);

    const decay = Math.exp(-dt * 3.0 / FRACTURE_CONFIG.recoverySpeed);

    // pass 1: update damage (ping-pong)
    const dU = damagePass.material.uniforms;
    dU.uPrev.value = rtA.texture;
    dU.uMouse.value.copy(smoothedMouse);
    dU.uDir.value.copy(dir);
    dU.uEnergy.value = energy;
    dU.uDecay.value = decay;

    renderer.setRenderTarget(rtB);
    renderer.render(damagePass.scene, damagePass.camera);

    // pass 2: draw the visible fracture using the freshly updated damage
    mainPass.material.uniforms.uDamage.value = rtB.texture;
    renderer.setRenderTarget(null);
    renderer.render(mainPass.scene, mainPass.camera);

    // swap ping-pong targets
    const tmp = rtA; rtA = rtB; rtB = tmp;
  }
  rafId = requestAnimationFrame(frame);

  /* ---------------- cleanup (exposed for completeness; not auto-invoked on a static page) ---------------- */
  window.__heroFractureDestroy = function destroy() {
    cancelAnimationFrame(rafId);
    ro?.disconnect();
    window.removeEventListener('resize', resize);
    rtA.dispose();
    rtB.dispose();
    damagePass.material.dispose();
    mainPass.material.dispose();
    renderer.dispose();
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
