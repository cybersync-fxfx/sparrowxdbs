import * as THREE from "three";

/**
 * Procedural NASA-grade Earth Texture Generator for Three.js
 * Generates high-resolution Day, Night Lights, Cloud, and Specular textures
 * completely offline with zero external network dependencies.
 */

// Equirectangular projection helper: [lat, lon] -> [x, y] on canvas
function project(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

// Major continental landmass polygons in [lat, lon] coordinates
export const CONTINENTS_GEO: {
  name: string;
  type: "continent" | "island" | "desert" | "mountain" | "polar";
  color?: string;
  coords: [number, number][];
}[] = [
  // 1. North America (Alaska, Canada, USA, Mexico, Central America)
  {
    name: "North America",
    type: "continent",
    coords: [
      [71, -156], [70, -141], [69, -135], [60, -125], [54, -130],
      [49, -124], [46, -124], [38, -123], [34, -120], [32, -117],
      [28, -114], [23, -110], [19, -105], [16, -98], [15, -92],
      [14, -89], [9, -83], [8, -77], [10, -75], [16, -83],
      [18, -88], [21, -87], [22, -97], [26, -97], [29, -94],
      [30, -88], [28, -82], [25, -80], [30, -81], [35, -75],
      [41, -71], [44, -66], [47, -65], [49, -67], [52, -56],
      [58, -62], [62, -64], [62, -76], [58, -80], [53, -82],
      [51, -80], [57, -92], [64, -94], [68, -88], [69, -97],
      [68, -108], [69, -115], [70, -127], [70, -141], [71, -156],
      [65, -168], [60, -165], [58, -158], [57, -152], [60, -140],
      [60, -146], [61, -151], [65, -168],
    ],
  },
  // 2. South America
  {
    name: "South America",
    type: "continent",
    coords: [
      [12, -72], [11, -63], [7, -58], [4, -51], [0, -50],
      [-2, -44], [-5, -35], [-8, -35], [-13, -38], [-23, -42],
      [-28, -49], [-34, -54], [-38, -57], [-45, -66], [-52, -68],
      [-55, -66], [-53, -71], [-50, -75], [-44, -74], [-38, -73],
      [-30, -71], [-20, -70], [-15, -75], [-9, -79], [-4, -81],
      [1, -79], [6, -77], [9, -76], [12, -72],
    ],
  },
  // 3. Eurasia (Europe & Asia mainland)
  {
    name: "Eurasia",
    type: "continent",
    coords: [
      // Western Europe & Scandinavia
      [36, -6], [43, -9], [44, -1], [48, -4], [50, 1],
      [54, 8], [57, 8], [58, 11], [63, 20], [69, 16],
      [71, 28], [68, 43], [67, 50], [69, 60], [73, 72],
      [76, 95], [77, 105], [74, 135], [71, 150], [69, 170],
      [65, 179], [66, -170], [64, 173], [60, 163], [56, 163],
      [51, 156], [45, 142], [42, 131], [39, 128], [37, 126],
      [34, 127], [38, 129], [40, 124], [38, 118], [32, 121],
      [28, 122], [22, 114], [21, 108], [16, 108], [11, 104],
      [1, 104], [6, 100], [14, 101], [16, 96], [21, 89],
      [22, 91], [16, 82], [10, 80], [8, 77], [13, 74],
      [20, 73], [24, 69], [25, 62], [24, 57], [17, 54],
      [13, 45], [12, 43], [20, 40], [28, 35], [31, 34],
      [36, 36], [41, 29], [41, 27], [40, 23], [37, 22],
      [38, 16], [41, 14], [44, 12], [44, 8], [42, 3],
      [36, -4], [36, -6],
    ],
  },
  // 4. Africa
  {
    name: "Africa",
    type: "continent",
    coords: [
      [37, 10], [36, 1], [35, -5], [30, -10], [21, -17],
      [15, -17], [11, -15], [5, -8], [4, 2], [4, 9],
      [2, 9], [-4, 12], [-8, 13], [-18, 12], [-28, 16],
      [-34, 18], [-34, 26], [-30, 31], [-25, 33], [-15, 40],
      [-10, 40], [-4, 39], [2, 45], [11, 51], [12, 44],
      [15, 41], [22, 37], [28, 33], [31, 32], [32, 25],
      [31, 18], [37, 10],
    ],
  },
  // 5. Australia
  {
    name: "Australia",
    type: "continent",
    coords: [
      [-12, 132], [-12, 136], [-15, 136], [-17, 141], [-11, 142],
      [-15, 145], [-20, 148], [-25, 153], [-28, 153], [-32, 152],
      [-37, 150], [-38, 145], [-35, 139], [-35, 136], [-32, 132],
      [-34, 123], [-35, 117], [-32, 115], [-26, 113], [-22, 114],
      [-20, 119], [-16, 123], [-14, 126], [-15, 130], [-12, 132],
    ],
  },
  // 6. Greenland
  {
    name: "Greenland",
    type: "island",
    coords: [
      [83, -30], [82, -20], [76, -20], [70, -22], [65, -40],
      [60, -44], [60, -47], [64, -52], [69, -54], [73, -56],
      [76, -65], [78, -73], [81, -65], [83, -40], [83, -30],
    ],
  },
  // 7. Antarctica (Polar ice sheet)
  {
    name: "Antarctica",
    type: "polar",
    coords: [
      [-64, -60], [-66, -64], [-70, -75], [-73, -100], [-74, -130],
      [-76, -160], [-78, 170], [-72, 170], [-67, 140], [-66, 110],
      [-67, 90], [-68, 70], [-69, 40], [-70, 10], [-72, -10],
      [-75, -30], [-71, -45], [-64, -60], [-89, -180], [-89, 180],
    ],
  },
  // 8. Key Major Islands
  // Great Britain & Ireland
  {
    name: "Great Britain",
    type: "island",
    coords: [[58, -5], [58, -2], [54, 0], [51, 1], [50, -5], [53, -4], [56, -6], [58, -5]],
  },
  {
    name: "Ireland",
    type: "island",
    coords: [[55, -7], [54, -6], [52, -6], [51, -10], [54, -10], [55, -7]],
  },
  // Japan (Honshu/Hokkaido)
  {
    name: "Japan",
    type: "island",
    coords: [
      [45, 142], [43, 145], [41, 141], [38, 142], [35, 140],
      [33, 135], [31, 131], [33, 130], [35, 133], [37, 137],
      [40, 140], [43, 141], [45, 142],
    ],
  },
  // Madagascar
  {
    name: "Madagascar",
    type: "island",
    coords: [[-12, 49], [-16, 50], [-25, 47], [-25, 44], [-17, 44], [-12, 49]],
  },
  // Indonesia (Sumatra, Borneo, Java)
  {
    name: "Sumatra",
    type: "island",
    coords: [[5, 96], [3, 99], [-3, 103], [-6, 106], [-4, 102], [1, 98], [5, 96]],
  },
  {
    name: "Borneo",
    type: "island",
    coords: [[7, 117], [5, 119], [1, 118], [-3, 116], [-4, 112], [1, 109], [4, 114], [7, 117]],
  },
  {
    name: "New Zealand",
    type: "island",
    coords: [
      [-35, 174], [-38, 178], [-41, 175], [-46, 169], [-46, 166],
      [-42, 171], [-38, 175], [-35, 174],
    ],
  },
  {
    name: "Iceland",
    type: "island",
    coords: [[66, -16], [64, -14], [63, -18], [65, -24], [66, -22], [66, -16]],
  },
];

// Major mountain ranges for elevation relief shading
const MOUNTAIN_CHAINS: [number, number][][] = [
  // Himalayas
  [[35, 74], [32, 79], [28, 85], [27, 90], [28, 97]],
  // Andes
  [[10, -73], [2, -76], [-8, -78], [-18, -69], [-28, -69], [-40, -71], [-52, -73]],
  // Rocky Mountains
  [[60, -125], [52, -117], [45, -111], [38, -106], [31, -104]],
  // Alps
  [[46, 6], [46, 9], [47, 12], [47, 15]],
];

// Major arid desert zones for authentic terrestrial coloring
const DESERT_ZONES: [number, number, number, number][] = [
  // [latMin, latMax, lonMin, lonMax]
  [16, 30, -15, 35], // Sahara
  [18, 32, 38, 55],  // Arabian Peninsula
  [38, 46, 85, 110], // Gobi / Taklamakan
  [-30, -20, 115, 140], // Australian Outback
  [30, 38, -115, -102], // Mojave / Sonoran
];

// High-density urban centers for realistic night city lights
const METROPOLITAN_CLUSTERS: { lat: number; lon: number; intensity: number; size: number }[] = [
  // US & Canada
  { lat: 40.71, lon: -74.0, intensity: 1.0, size: 28 }, // New York
  { lat: 42.36, lon: -71.06, intensity: 0.9, size: 18 }, // Boston
  { lat: 38.9, lon: -77.03, intensity: 0.95, size: 22 }, // Washington DC
  { lat: 41.87, lon: -87.62, intensity: 0.9, size: 24 }, // Chicago
  { lat: 34.05, lon: -118.24, intensity: 0.95, size: 26 }, // Los Angeles
  { lat: 37.77, lon: -122.42, intensity: 0.95, size: 24 }, // San Francisco / Silicon Valley
  { lat: 29.76, lon: -95.36, intensity: 0.85, size: 20 }, // Houston
  { lat: 43.65, lon: -79.38, intensity: 0.85, size: 20 }, // Toronto
  { lat: 45.5, lon: -73.56, intensity: 0.8, size: 16 }, // Montreal
  // Europe
  { lat: 51.5, lon: -0.12, intensity: 1.0, size: 28 }, // London
  { lat: 48.85, lon: 2.35, intensity: 0.95, size: 26 }, // Paris
  { lat: 50.11, lon: 8.68, intensity: 0.95, size: 24 }, // Frankfurt / Rhine-Ruhr
  { lat: 52.52, lon: 13.4, intensity: 0.85, size: 20 }, // Berlin
  { lat: 52.36, lon: 4.9, intensity: 0.9, size: 18 }, // Amsterdam
  { lat: 45.46, lon: 9.19, intensity: 0.85, size: 18 }, // Milan
  { lat: 40.41, lon: -3.7, intensity: 0.85, size: 18 }, // Madrid
  { lat: 55.75, lon: 37.62, intensity: 0.9, size: 22 }, // Moscow
  // Asia & Middle East
  { lat: 35.68, lon: 139.69, intensity: 1.0, size: 32 }, // Tokyo
  { lat: 34.69, lon: 135.5, intensity: 0.9, size: 24 }, // Osaka
  { lat: 37.56, lon: 126.97, intensity: 0.95, size: 26 }, // Seoul
  { lat: 39.9, lon: 116.4, intensity: 0.95, size: 28 }, // Beijing
  { lat: 31.23, lon: 121.47, intensity: 1.0, size: 30 }, // Shanghai
  { lat: 22.31, lon: 114.16, intensity: 0.95, size: 24 }, // Hong Kong / Shenzhen
  { lat: 25.03, lon: 121.56, intensity: 0.9, size: 18 }, // Taipei
  { lat: 28.61, lon: 77.2, intensity: 0.95, size: 26 }, // Delhi
  { lat: 19.07, lon: 72.87, intensity: 0.95, size: 26 }, // Mumbai
  { lat: 13.08, lon: 80.27, intensity: 0.85, size: 20 }, // Chennai
  { lat: 12.97, lon: 77.59, intensity: 0.9, size: 22 }, // Bengaluru
  { lat: 1.35, lon: 103.82, intensity: 1.0, size: 22 }, // Singapore
  { lat: 25.2, lon: 55.27, intensity: 0.95, size: 22 }, // Dubai
  { lat: 24.71, lon: 46.67, intensity: 0.85, size: 18 }, // Riyadh
  // South America, Africa & Oceania
  { lat: -23.55, lon: -46.63, intensity: 0.95, size: 28 }, // São Paulo
  { lat: -22.9, lon: -43.17, intensity: 0.9, size: 22 }, // Rio de Janeiro
  { lat: -34.6, lon: -58.38, intensity: 0.85, size: 22 }, // Buenos Aires
  { lat: 6.52, lon: 3.38, intensity: 0.85, size: 20 }, // Lagos
  { lat: 30.04, lon: 31.23, intensity: 0.9, size: 22 }, // Cairo
  { lat: -26.2, lon: 28.04, intensity: 0.85, size: 20 }, // Johannesburg
  { lat: -33.87, lon: 151.2, intensity: 0.9, size: 24 }, // Sydney
  { lat: -37.81, lon: 144.96, intensity: 0.85, size: 22 }, // Melbourne
];

/**
 * 1. Generate High-Fidelity Day Surface Map Texture
 */
export function generateEarthDayTexture(width = 2048, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // A. Deep Oceanic Gradient with realistic bathymetry
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, "#010814"); // Arctic deep
  oceanGrad.addColorStop(0.25, "#021226"); // North Atlantic/Pacific
  oceanGrad.addColorStop(0.5, "#031730"); // Equatorial deep
  oceanGrad.addColorStop(0.75, "#021226"); // South ocean
  oceanGrad.addColorStop(1, "#010814"); // Antarctic deep
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle lat/long graticule grid lines (military/intel style)
  ctx.strokeStyle = "rgba(0, 229, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // B. Draw Coastal Shelf Bathymetry Halo around continents
  ctx.shadowColor = "rgba(0, 160, 220, 0.35)";
  ctx.shadowBlur = 12;
  CONTINENTS_GEO.forEach((cont) => {
    if (cont.coords.length < 3) return;
    ctx.beginPath();
    cont.coords.forEach(([lat, lon], idx) => {
      const [x, y] = project(lat, lon, width, height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(5, 37, 72, 0.6)";
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // C. Fill Continents with realistic geological base colors
  CONTINENTS_GEO.forEach((cont) => {
    if (cont.coords.length < 3) return;
    ctx.beginPath();
    cont.coords.forEach(([lat, lon], idx) => {
      const [x, y] = project(lat, lon, width, height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    if (cont.type === "polar") {
      ctx.fillStyle = "#dceaf2"; // Polar ice sheet
    } else {
      // Natural high-contrast temperate green/brown terrain
      const landGrad = ctx.createLinearGradient(0, 0, 0, height);
      landGrad.addColorStop(0.08, "#1a3320");
      landGrad.addColorStop(0.35, "#2d4e30");
      landGrad.addColorStop(0.55, "#27482b");
      landGrad.addColorStop(0.85, "#1e3b23");
      ctx.fillStyle = landGrad;
    }
    ctx.fill();

    // High-tech crisp continental boundary line with subtle cyan glow
    ctx.strokeStyle = "rgba(0, 229, 255, 0.48)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });

  // D. Paint Arid & Desert Biomes
  DESERT_ZONES.forEach(([latMin, latMax, lonMin, lonMax]) => {
    const [x1, y2] = project(latMin, lonMin, width, height);
    const [x2, y1] = project(latMax, lonMax, width, height);
    const grad = ctx.createRadialGradient(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      5,
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      Math.abs(x2 - x1) * 0.48,
    );
    grad.addColorStop(0, "rgba(100, 78, 45, 0.7)");
    grad.addColorStop(0.7, "rgba(75, 62, 38, 0.45)");
    grad.addColorStop(1, "rgba(75, 62, 38, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      Math.abs(x2 - x1) * 0.48,
      Math.abs(y2 - y1) * 0.48,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });

  // E. Paint Mountain Elevation Relief Ridges
  MOUNTAIN_CHAINS.forEach((chain) => {
    ctx.beginPath();
    chain.forEach(([lat, lon], idx) => {
      const [x, y] = project(lat, lon, width, height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(130, 115, 100, 0.55)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.strokeStyle = "rgba(220, 230, 240, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * 2. Generate Night City Lights Texture (Dark side illumination)
 */
export function generateEarthNightTexture(width = 2048, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Pitch black base
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Render illuminated urban metropolitan networks
  METROPOLITAN_CLUSTERS.forEach((metro) => {
    const [cx, cy] = project(metro.lat, metro.lon, width, height);
    const radius = metro.size * (width / 2048);

    // Warm golden-amber core with subtle cyan cyber glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 245, 180, ${metro.intensity})`);
    grad.addColorStop(0.2, `rgba(255, 180, 50, ${metro.intensity * 0.85})`);
    grad.addColorStop(0.5, `rgba(240, 120, 20, ${metro.intensity * 0.45})`);
    grad.addColorStop(0.75, `rgba(0, 229, 255, ${metro.intensity * 0.2})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Intercity transport/cyber corridors radiating outwards
    ctx.strokeStyle = `rgba(255, 200, 80, ${metro.intensity * 0.35})`;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.random() * 0.5;
      const dist = radius * (1.2 + Math.random() * 1.5);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
      ctx.stroke();
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * 3. Generate Realistic Atmospheric Clouds Texture with alpha transparency
 */
export function generateEarthCloudTexture(width = 2048, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Clear transparent background
  ctx.clearRect(0, 0, width, height);

  // Multi-octave cloud noise simulation using overlapping soft gradients
  const numCloudPuffs = 420;
  for (let i = 0; i < numCloudPuffs; i++) {
    // Bias towards tropical bands (ITCZ) and mid-latitude storm tracks
    let lat = (Math.random() - 0.5) * 140;
    if (Math.random() < 0.35) lat = (Math.random() - 0.5) * 25; // Intertropical convergence
    else if (Math.random() < 0.4) lat = 45 + (Math.random() - 0.5) * 20; // North storm track
    else if (Math.random() < 0.4) lat = -45 + (Math.random() - 0.5) * 20; // South storm track

    const lon = (Math.random() - 0.5) * 360;
    const [cx, cy] = project(lat, lon, width, height);

    const radiusX = (30 + Math.random() * 90) * (width / 2048);
    const radiusY = (15 + Math.random() * 45) * (height / 1024);
    const rotation = (Math.random() - 0.5) * 0.8;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusX);
    const density = 0.25 + Math.random() * 0.45;
    grad.addColorStop(0, `rgba(255, 255, 255, ${density})`);
    grad.addColorStop(0.4, `rgba(240, 248, 255, ${density * 0.65})`);
    grad.addColorStop(0.8, `rgba(220, 240, 255, ${density * 0.2})`);
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw 2 swirling cyclonic storm spirals (hurricanes / typhoons)
  const storms: [number, number][] = [
    [24, -68], // Atlantic
    [20, 134], // Northwest Pacific
  ];
  storms.forEach(([sLat, sLon]) => {
    const [scx, scy] = project(sLat, sLon, width, height);
    for (let a = 0; a < Math.PI * 4; a += 0.15) {
      const r = a * 12 * (width / 2048);
      const px = scx + Math.cos(a) * r;
      const py = scy + Math.sin(a) * r;
      const pGrad = ctx.createRadialGradient(px, py, 0, px, py, 14);
      pGrad.addColorStop(0, "rgba(255, 255, 255, 0.6)");
      pGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * 4. Generate Ocean Specular Shininess Map
 * Oceans are reflective white; continents are non-reflective black.
 */
export function generateEarthSpecularTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Pure white for oceans (maximum specular shine)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Continents are matte black (zero specular reflection)
  CONTINENTS_GEO.forEach((cont) => {
    if (cont.coords.length < 3) return;
    ctx.beginPath();
    cont.coords.forEach(([lat, lon], idx) => {
      const [x, y] = project(lat, lon, width, height);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = cont.type === "polar" ? "#666666" : "#000000";
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}
