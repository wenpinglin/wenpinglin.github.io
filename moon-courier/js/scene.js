// scene.js — 3D 场景（M4.5 视觉大升级）：三层星空+银河带 / 程序化地球(云层+大气辉光) / 月壤贴图跑道+岩石散布
// M5-1：动态画质降级 setQuality(0~3)
// 跑道平面固定不动（覆盖玩家视野 [-100,300]）；坑/岩石/星屑沿 -z 后退产生前进感
import * as THREE from 'three';
import { Config } from './config.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.Fog(0x0a1020, 60, Config.drawDistance * 0.85);

  const camera = new THREE.PerspectiveCamera(Config.fov, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(0, Config.cameraHeight, -Config.cameraBack);
  camera.lookAt(0, 1, Config.cameraLookAhead);

  // === 光照 ===
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.6);
  sun.position.set(-8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x3a4a6a, 0.55);
  scene.add(ambient);

  const earthBounce = new THREE.DirectionalLight(0x4a7fb5, 0.35);
  earthBounce.position.set(10, 6, -8);
  scene.add(earthBounce);

  // === 月面（贴图跑道 + 岩石） ===
  const moonEnv = createMoonSurface(scene);
  scene.add(moonEnv.mesh);

  // === 星空（三层 + 银河带） ===
  const starEnv = createStarfield(scene);
  const starsBright = starEnv.brightMat;

  // === 地球（噪声大陆 + 云层 + 大气辉光） ===
  const earthEnv = createEarth();
  scene.add(earthEnv.group);

  // === 动态画质降级（M5-1：低帧率渐进降档） ===
  function setQuality(level) {
    if (level >= 1) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      sun.castShadow = false;
      renderer.shadowMap.enabled = false;
    }
    if (level >= 2) {
      if (starEnv.starLayers[1]) starEnv.starLayers[1].visible = false;
      if (starEnv.starLayers[2]) starEnv.starLayers[2].visible = false;
      moonEnv.setRockDensity(0.5);
    }
    if (level >= 3) {
      if (starEnv.starLayers[0]) starEnv.starLayers[0].material.size *= 0.7;
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    renderer, scene, camera, sun, ambient,
    moon: moonEnv.mesh,
    earth: earthEnv.group,
    earthUpdate: earthEnv.update,   // 地球自转（globe + clouds）
    starsBright,                    // 亮星材质（skyfx 闪烁用）
    updateRocks: moonEnv.updateRocks,
    setQuality,                     // M5-1 动态画质降级
    dispose: () => window.removeEventListener('resize', onResize),
  };
}

// ============ 月面：周期化地形 + 程序纹理 + 岩石散布 ============
const TRACK_W = 24;      // 跑道宽
const TRACK_L = 400;     // 跑道长（纹理/地形/岩石周期，随 curZ 无缝循环）

function createMoonSurface(scene) {
  // --- 程序化月壤贴图 ---
  const tex = createMoonTexture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 8);

  const geo = new THREE.PlaneGeometry(TRACK_W, TRACK_L, 32, 160);
  geo.rotateX(-Math.PI / 2);

  // 周期化顶点起伏（所有 z 向频率都是 400 的整数分之一 → 首尾无缝）
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, surfaceHeight(x, z));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xcfc9bd, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  // 跑道固定：覆盖 z ∈ [-100, 300]，玩家视野前方 0~220 永远有月面（不随玩家移动）
  mesh.position.z = TRACK_L / 2 - 100;

  // --- 岩石散布（InstancedMesh，独立场景层，随玩家沿 -z 后退） ---
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1, flatShading: true });
  const ROCKS = 42;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  rocks.castShadow = true;
  const rockData = [];
  for (let i = 0; i < ROCKS; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    rockData.push({
      x: side * (4.5 + Math.random() * 7.5),       // 避开跑道中心 ±3.5
      z: Math.random() * TRACK_L,
      s: 0.18 + Math.random() * 0.55,
      ry: Math.random() * Math.PI,
      rx: Math.random() * Math.PI,
    });
  }
  scene.add(rocks);   // 场景级：岩石整体沿 -z 后退产生跑过感，400m 周期无缝

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3(1, 1, 1);
  function updateRocks(playerZ) {
    rocks.position.z = 100 - playerZ;   // 与坑同一后退方向（-z）
    const span = TRACK_L;
    const n = rocks.count;
    for (let i = 0; i < n; i++) {
      const r = rockData[i];
      // 世界位置 = 段内偏移 + 段基址；落到玩家后方 30m 以外则前移一个周期
      let worldZ = r.z + rocks.position.z;
      if (worldZ < -30) r.z += span;
      worldZ = r.z + rocks.position.z;
      _e.set(r.rx, r.ry, 0);
      _q.setFromEuler(_e);
      _m.compose(new THREE.Vector3(r.x, r.s * 0.35, worldZ), _q, _v.set(r.s, r.s * 0.8, r.s));
      rocks.setMatrixAt(i, _m);
    }
    rocks.instanceMatrix.needsUpdate = true;
  }
  // M5-1：低画质下减少岩石数量
  function setRockDensity(ratio) {
    rocks.count = Math.max(1, Math.floor(ROCKS * ratio));
    rocks.instanceMatrix.needsUpdate = true;
  }
  updateRocks(0);

  return { mesh, updateRocks, setRockDensity };
}

// 周期化地形函数（z 周期 = TRACK_L，首尾无缝）
function surfaceHeight(x, z) {
  const d = Math.min(1, Math.abs(x) / (TRACK_W / 2));
  const TAU = Math.PI * 2 / TRACK_L;
  const base =
    Math.sin(z * TAU * 5) * 0.28 +
    Math.cos(z * TAU * 8 + x * 0.31) * 0.22 +
    Math.sin(z * TAU * 13 + 1.7) * 0.16;
  const lateral = Math.sin(x * 0.55) * 0.28 + Math.cos(x * 0.23 + z * TAU * 2) * 0.2;
  return (base * 0.6 + lateral) * d * d;   // 跑道中心平，两侧起伏加大
}

// 程序化月壤贴图：噪声底 + 陨石坑斑 + 亮边 + 细颗粒
function createMoonTexture() {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#b6b0a4');
  bg.addColorStop(0.5, '#c9c3b7');
  bg.addColorStop(1, '#aba698');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // 噪声颗粒
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // 陨石坑斑（暗坑+亮边），均匀撒布可平铺
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 2 + Math.random() * 14;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(70,68,62,0.55)');
    g.addColorStop(0.7, 'rgba(90,88,82,0.25)');
    g.addColorStop(1, 'rgba(220,215,200,0.28)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // 裂纹线
  ctx.strokeStyle = 'rgba(88,86,80,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * S, y = Math.random() * S;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (Math.random() - 0.5) * 36; y += (Math.random() - 0.5) * 36;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

// ============ 星空：三层 + 银河带 + 亮星闪烁 ============
function createStarfield(scene) {
  const starLayers = [];
  const layers = [
    { n: 2400, size: 0.55, rMin: 190, rMax: 240, colorMix: 0.12 },  // 远层密集小星
    { n: 800,  size: 0.95, rMin: 170, rMax: 220, colorMix: 0.3 },  // 中层
    { n: 130,  size: 1.6,  rMin: 150, rMax: 200, colorMix: 0.55 }, // 亮层（带色）
  ];
  let brightMat = null;
  layers.forEach((L, li) => {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(L.n * 3);
    const col = new Float32Array(L.n * 3);
    for (let i = 0; i < L.n; i++) {
      let x, y, z;
      if (Math.random() < 0.3) {
        const t = Math.random() * Math.PI * 2;
        const r = L.rMin + Math.random() * (L.rMax - L.rMin);
        const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 40;
        const bandAngle = 0.5;
        x = r * Math.cos(t);
        z = r * Math.sin(t);
        y = spread * Math.cos(bandAngle);
        x += spread * Math.sin(bandAngle) * 0.6;
      } else {
        const r = L.rMin + Math.random() * (L.rMax - L.rMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.55;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi) * 0.55 + 18;
        z = r * Math.sin(phi) * Math.sin(theta);
      }
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      const c = Math.random();
      let cr = 1, cg = 1, cb = 1;
      if (c < L.colorMix * 0.6) { cr = 0.68; cg = 0.8; cb = 1; }
      else if (c < L.colorMix) { cr = 1; cg = 0.85; cb = 0.62; }
      const b = 0.55 + Math.random() * 0.45;
      col[i * 3] = cr * b; col[i * 3 + 1] = cg * b; col[i * 3 + 2] = cb * b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: L.size, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: li === 2 ? 0.95 : 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    starLayers.push(pts);
    if (li === 2) brightMat = mat;
  });
  return { brightMat, starLayers };
}

// ============ 地球：噪声大陆 + 极地冰盖 + 云层自转 + 大气辉光 ============
function createEarth() {
  const R = 9;
  const group = new THREE.Group();

  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  const grids = [];
  for (let o = 0; o < 4; o++) grids.push(makeGrid(4 << o));
  function makeGrid(n) {
    const g = [];
    for (let i = 0; i <= n; i++) { g[i] = []; for (let j = 0; j <= n * 0.6 + 1; j++) g[i][j] = Math.random(); }
    return g;
  }
  function noise(x, y) {
    let v = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < 4; o++) {
      const g = grids[o];
      const nx = x * freq, ny = y * freq * 1.6667;
      const x0 = Math.floor(nx), y0 = Math.floor(ny);
      const fx = nx - x0, fy = ny - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const n0 = g[x0 % g.length][y0 % g[0].length] ?? 0;
      const n1 = g[(x0 + 1) % g.length][y0 % g[0].length] ?? 0;
      const n2 = g[x0 % g.length][(y0 + 1) % g[0].length] ?? 0;
      const n3 = g[(x0 + 1) % g.length][(y0 + 1) % g[0].length] ?? 0;
      v += amp * ((n0 * (1 - sx) + n1 * sx) * (1 - sy) + (n2 * (1 - sx) + n3 * sx) * sy);
      amp *= 0.5; freq *= 2.1;
    }
    return v;
  }

  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const u = x / W, v = y / H;
      const h = noise(u, v * 0.6);
      const lat = Math.abs(v - 0.5) * 2;
      let r, g, b;
      if (h > 0.54) {
        const t = (h - 0.54) / 0.3;
        r = 46 + t * 96; g = 92 + t * 44; b = 48 + t * 30;
      } else {
        const t = Math.max(0, (0.54 - h)) / 0.4;
        r = 26 + (1 - t) * 26; g = 62 + (1 - t) * 44; b = 112 + (1 - t) * 52;
      }
      if (lat > 0.78) {
        const t = Math.min(1, (lat - 0.78) / 0.14);
        r = r * (1 - t) + 232 * t; g = g * (1 - t) + 240 * t; b = b * (1 - t) + 248 * t;
      }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 48, 48),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.05, emissive: 0x0a1a30, emissiveIntensity: 0.25 })
  );
  group.add(globe);

  // 云层
  const cv2 = document.createElement('canvas');
  cv2.width = W; cv2.height = H;
  const c2 = cv2.getContext('2d');
  c2.clearRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W, y = 20 + Math.random() * (H - 40);
    const w = 14 + Math.random() * 52, h = 5 + Math.random() * 12;
    const g2 = c2.createRadialGradient(x, y, 0, x, y, w);
    g2.addColorStop(0, 'rgba(255,255,255,0.85)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = g2;
    c2.beginPath(); c2.ellipse(x, y, w, h, 0, 0, Math.PI * 2); c2.fill();
  }
  const cloudTex = new THREE.CanvasTexture(cv2);
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.018, 48, 48),
    new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 })
  );
  group.add(clouds);

  // 大气辉光
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.13, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x4a9ae8, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(atmo);

  group.position.set(42, 34, 130);
  group.rotation.z = 0.41;

  return {
    group,
    update(dt) {
      globe.rotation.y += dt * 0.012;
      clouds.rotation.y += dt * 0.02;
    },
  };
}