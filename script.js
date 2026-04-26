

const debrisSources = [
  {
    key: "fengyun",
    label: "Fengyun 1C debris",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle",
    color: 0x59d9ff
  },
  {
    key: "iridium",
    label: "Iridium 33 debris",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle",
    color: 0x9df28c
  },
  {
    key: "cosmos",
    label: "Cosmos 2251 debris",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
    color: 0xffd166
  }
];

let scene;
let camera;
let renderer;
let controls;
let debrisObjects = [];
let currentFilter = "all";

const earthRadius = 5;
const altitudeScale = 0.0002;

document.addEventListener("DOMContentLoaded", () => {
  setupMobileNav();
  setupForm();
  setupMap();
  setupMapButtons();
});

function setupMobileNav() {
  const button = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");

  button.addEventListener("click", () => {
    links.classList.toggle("show");
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("show");
    });
  });
}

function setupForm() {
  const form = document.getElementById("actionForm");
  const response = document.getElementById("formResponse");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const name = document.getElementById("name").value.trim();

    response.textContent = `Thanks, ${name}. This is where the campaign would submit or preview your message.`;
    form.reset();
  });
}

function setupMap() {
  const mapElement = document.getElementById("debrisMap");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020812);

  camera = new THREE.PerspectiveCamera(
    45,
    mapElement.clientWidth / mapElement.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 10, 18);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(mapElement.clientWidth, mapElement.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  mapElement.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 45;

  addLights();
  addEarth();
  addStars();

  loadDebrisData();

  document.getElementById("resetView").addEventListener("click", () => {
    camera.position.set(0, 10, 18);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  window.addEventListener("resize", resizeMap);
  animate();
}

function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
  sunLight.position.set(10, 6, 8);
  scene.add(sunLight);
}

function addEarth() {
  // The earth texture is made with canvas instead of an image file.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#123b68");
  gradient.addColorStop(0.5, "#0b6d92");
  gradient.addColorStop(1, "#102c4a");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rough land shapes. Not accurate, just to make the globe readable.
  ctx.fillStyle = "rgba(69, 132, 97, 0.85)";
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 80 + Math.random() * 160;
    const h = 25 + Math.random() * 65;

    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  for (let lon = 0; lon < canvas.width; lon += 64) {
    ctx.beginPath();
    ctx.moveTo(lon, 0);
    ctx.lineTo(lon, canvas.height);
    ctx.stroke();
  }
  for (let lat = 0; lat < canvas.height; lat += 64) {
    ctx.beginPath();
    ctx.moveTo(0, lat);
    ctx.lineTo(canvas.width, lat);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);

  const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: texture,
    shininess: 20
  });

  const earth = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earth);

  const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.03, 64, 64);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x59d9ff,
    transparent: true,
    opacity: 0.09
  });

  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  scene.add(atmosphere);
}

function addStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];

  for (let i = 0; i < 900; i++) {
    const x = (Math.random() - 0.5) * 180;
    const y = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    starPositions.push(x, y, z);
  }

  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3)
  );

  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

async function loadDebrisData() {
  const status = document.getElementById("mapStatus");
  status.textContent = "Loading public catalog data from CelesTrak...";

  try {
    for (const source of debrisSources) {
      const tleText = await fetchText(source.url);
      const parsedObjects = parseTleFile(tleText, source);
      addDebrisPoints(parsedObjects);
    }

    applyFilter("all");
    status.textContent =
      "The map is showing cataloged debris objects from selected public CelesTrak debris groups.";
  } catch (error) {
    console.warn("Using backup debris points because the live data could not load.", error);

    const backupObjects = makeBackupDebris();
    addDebrisPoints(backupObjects);
    applyFilter("all");

    status.textContent =
      "Live data could not load, so the map is showing backup sample debris points. Use Live Server and internet access for the live version.";
  }
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }

  return response.text();
}

function parseTleFile(text, source) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const objects = [];

  for (let i = 0; i < lines.length - 2; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) {
      continue;
    }

    const satrec = satellite.twoline2satrec(line1, line2);
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);

    if (!positionAndVelocity.position) {
      continue;
    }

    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);
    const altitudeKm = geo.height;

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altitudeKm)) {
      continue;
    }

    objects.push({
      name,
      group: source.key,
      label: source.label,
      color: source.color,
      lat,
      lon,
      altitudeKm
    });
  }

  return objects;
}

function addDebrisPoints(objects) {
  objects.forEach((object) => {
    const position = latLonAltToVector(object.lat, object.lon, object.altitudeKm);

    const geometry = new THREE.SphereGeometry(0.045, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: object.color
    });

    const point = new THREE.Mesh(geometry, material);
    point.position.copy(position);
    point.userData = object;

    debrisObjects.push(point);
    scene.add(point);
  });
}

function latLonAltToVector(latDegrees, lonDegrees, altitudeKm) {
  const lat = THREE.Math.degToRad(latDegrees);
  const lon = THREE.Math.degToRad(lonDegrees);

  // Altitude is exaggerated so the dots are visible above the globe.
  const visibleAltitude = Math.min(Math.max(altitudeKm, 0), 30000);
  const radius = earthRadius + visibleAltitude * altitudeScale;

  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);

  return new THREE.Vector3(x, y, z);
}

function setupMapButtons() {
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      applyFilter(button.dataset.group);
    });
  });
}

function applyFilter(group) {
  currentFilter = group;

  let shown = 0;

  debrisObjects.forEach((object) => {
    const shouldShow = group === "all" || object.userData.group === group;
    object.visible = shouldShow;

    if (shouldShow) {
      shown++;
    }
  });

  document.getElementById("objectCount").textContent = shown.toLocaleString();
}

function makeBackupDebris() {
  const groups = [
    { key: "fengyun", label: "Fengyun 1C debris", color: 0x59d9ff },
    { key: "iridium", label: "Iridium 33 debris", color: 0x9df28c },
    { key: "cosmos", label: "Cosmos 2251 debris", color: 0xffd166 }
  ];

  const backup = [];

  groups.forEach((group) => {
    for (let i = 0; i < 160; i++) {
      backup.push({
        name: `${group.label} sample ${i + 1}`,
        group: group.key,
        label: group.label,
        color: group.color,
        lat: -65 + Math.random() * 130,
        lon: -180 + Math.random() * 360,
        altitudeKm: 500 + Math.random() * 1600
      });
    }
  });

  return backup;
}

function resizeMap() {
  const mapElement = document.getElementById("debrisMap");

  camera.aspect = mapElement.clientWidth / mapElement.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(mapElement.clientWidth, mapElement.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);

  // Slow rotation makes the map feel alive without being too distracting.
  debrisObjects.forEach((object) => {
    object.rotation.y += 0.002;
  });

  controls.update();
  renderer.render(scene, camera);
}