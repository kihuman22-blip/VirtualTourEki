import JSZip from 'jszip'
import type { Tour, Scene, Hotspot } from './tour-types'

interface ExportProgress {
  phase: 'downloading' | 'packaging' | 'done'
  current: number
  total: number
  label: string
}

type ProgressCallback = (progress: ExportProgress) => void

/**
 * Downloads an image and returns it as a blob.
 * Handles blob URLs, data URLs, and remote URLs.
 * Returns null if the download fails.
 */
async function downloadImage(url: string): Promise<Blob | null> {
  try {
    // Blob URLs and data URLs can be fetched directly without CORS issues
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const response = await fetch(url)
      if (!response.ok) return null
      return await response.blob()
    }

    // Remote URLs — try with cors first
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) return null
    return await response.blob()
  } catch {
    // Fallback without explicit mode
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      return await response.blob()
    } catch {
      console.warn('[tour-export] Failed to download image:', url)
      return null
    }
  }
}

function getExtension(url: string, fallback = 'jpg'): string {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
      return ext
    }
  } catch {
    // not a valid URL
  }
  return fallback
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'untitled'
}

/**
 * Generates a standalone index.html that can be opened in any browser
 * to view the virtual tour. Uses Three.js from a CDN.
 */
function generateStandaloneHTML(tour: Tour): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(tour.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
  #viewer { width: 100vw; height: 100vh; position: relative; }
  canvas { display: block; }

  .overlay { position: absolute; z-index: 10; pointer-events: none; }
  .overlay > * { pointer-events: auto; }

  .top-bar {
    top: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(to bottom, rgba(10,10,10,0.7), transparent);
  }
  .tour-title {
    background: rgba(30,30,30,0.8); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
    padding: 6px 12px; font-size: 14px; font-weight: 500;
  }

  .bottom-bar {
    bottom: 0; left: 0; right: 0;
    display: flex; align-items: flex-end; justify-content: center;
    padding: 16px; gap: 8px;
    background: linear-gradient(to top, rgba(10,10,10,0.7), transparent);
    padding-top: 60px;
  }

  .scene-btn {
    background: rgba(30,30,30,0.8); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
    padding: 6px 12px; color: #fff; font-size: 12px; cursor: pointer;
    transition: background 0.2s;
  }
  .scene-btn:hover { background: rgba(50,50,50,0.9); }
  .scene-btn.active { border-color: #4db8a4; color: #4db8a4; }

  /* Hotspot markers */
  .hotspot-marker {
    position: absolute; transform: translate(-50%, -50%);
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: transform 0.2s;
    border: 2px solid rgba(255,255,255,0.3);
    z-index: 5;
  }
  .hotspot-marker:hover { transform: translate(-50%, -50%) scale(1.15); }
  .hotspot-marker svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  /* Popup */
  .popup-overlay {
    position: absolute; inset: 0; z-index: 20;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .popup {
    background: #1a1a1a; border-radius: 12px;
    box-shadow: 0 8px 50px rgba(0,0,0,0.5);
    max-width: min(90vw, 28rem); min-width: 200px;
    max-height: 85vh; overflow-y: auto;
    position: relative; animation: popIn 0.2s ease-out;
  }
  @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .popup-close {
    position: absolute; top: 12px; right: 12px; z-index: 2;
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(0,0,0,0.4); border: none; color: rgba(255,255,255,0.7);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .popup-close:hover { color: #fff; background: rgba(0,0,0,0.6); }
  .popup-img { width: 100%; max-height: 320px; object-fit: contain; background: #000; display: block; }
  .popup-body { padding: 20px; padding-right: 48px; }
  .popup-body h3 { font-size: 16px; font-weight: 500; margin-bottom: 8px; }
  .popup-body p { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .popup-body a { color: #60a5fa; text-decoration: underline; }
  .popup-nav-btn {
    display: block; width: 100%; margin-top: 16px; padding: 10px;
    background: #fff; color: #000; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; cursor: pointer; text-align: center;
  }
  .popup-nav-btn:hover { background: rgba(255,255,255,0.9); }
  .hidden { display: none !important; }
</style>
</head>
<body>
<div id="viewer">
  <div class="overlay top-bar">
    <div class="tour-title" id="tourTitle"></div>
  </div>
  <div class="overlay bottom-bar" id="sceneBar"></div>
  <div id="hotspotLayer"></div>
  <div id="popupContainer" class="hidden"></div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
(function() {
  let tourData = null;
  let currentSceneId = null;
  let camera, scene, renderer, sphere;
  let isUserInteracting = false;
  let lon = 0, lat = 0, onPointerDownLon = 0, onPointerDownLat = 0;
  let onPointerDownX = 0, onPointerDownY = 0;
  let fov = 75;

  // Load tour data
  fetch('data/tour.json')
    .then(r => r.json())
    .then(data => {
      tourData = data;
      document.getElementById('tourTitle').textContent = data.name;
      fov = data.settings?.defaultFov || 75;
      initThree();
      buildSceneBar();
      loadScene(data.startSceneId || data.scenes[0]?.id);
      animate();
    })
    .catch(err => {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;"><h2>Error loading tour</h2><p>' + err.message + '</p></div>';
    });

  function initThree() {
    const container = document.getElementById('viewer');
    camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1100);
    scene = new THREE.Scene();

    const geometry = new THREE.SphereGeometry(500, 128, 80);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.insertBefore(renderer.domElement, container.firstChild);

    // Controls
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);
  }

  function onPointerDown(e) {
    if (e.target.closest('.overlay, .hotspot-marker, .popup-overlay, #popupContainer')) return;
    isUserInteracting = true;
    onPointerDownX = e.clientX;
    onPointerDownY = e.clientY;
    onPointerDownLon = lon;
    onPointerDownLat = lat;
  }
  function onPointerMove(e) {
    if (!isUserInteracting) return;
    lon = (onPointerDownX - e.clientX) * 0.15 + onPointerDownLon;
    lat = (e.clientY - onPointerDownY) * 0.15 + onPointerDownLat;
  }
  function onPointerUp() { isUserInteracting = false; }
  function onWheel(e) {
    e.preventDefault();
    fov = Math.max(30, Math.min(100, fov + e.deltaY * 0.05));
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function loadScene(sceneId) {
    const sceneData = tourData.scenes.find(s => s.id === sceneId);
    if (!sceneData) return;
    currentSceneId = sceneId;

    // Set initial view
    if (sceneData.initialViewDirection) {
      lon = sceneData.initialViewDirection.yaw || 0;
      lat = sceneData.initialViewDirection.pitch || 0;
    }

    // Load texture
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(sceneData.imageUrl, function(texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      sphere.material.map = texture;
      sphere.material.needsUpdate = true;
    });

    // Update scene bar active state
    document.querySelectorAll('.scene-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === sceneId);
    });

    // Close any open popup
    closePopup();

    // Render hotspots
    renderHotspots(sceneData);
  }

  function buildSceneBar() {
    const bar = document.getElementById('sceneBar');
    bar.innerHTML = '';
    tourData.scenes.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'scene-btn';
      btn.dataset.id = s.id;
      btn.textContent = s.name;
      btn.onclick = () => loadScene(s.id);
      bar.appendChild(btn);
    });
  }

  function renderHotspots(sceneData) {
    const layer = document.getElementById('hotspotLayer');
    layer.innerHTML = '';
    sceneData.hotspots.forEach(hs => {
      const marker = document.createElement('div');
      marker.className = 'hotspot-marker';
      marker.style.background = (hs.color || '#f59e0b') + 'cc';
      marker.dataset.yaw = hs.position.yaw;
      marker.dataset.pitch = hs.position.pitch;
      marker.dataset.id = hs.id;

      // Icon SVG
      if (hs.type === 'scene-link') {
        marker.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      } else if (hs.type === 'image') {
        marker.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
      } else {
        marker.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
      }

      marker.onclick = () => handleHotspotClick(hs);
      layer.appendChild(marker);
    });
  }

  function updateHotspotPositions() {
    const layer = document.getElementById('hotspotLayer');
    if (!layer) return;
    const markers = layer.querySelectorAll('.hotspot-marker');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const halfFovRad = THREE.MathUtils.degToRad(fov / 2);

    markers.forEach(marker => {
      const yaw = parseFloat(marker.dataset.yaw);
      const pitch = parseFloat(marker.dataset.pitch);
      const yawRad = THREE.MathUtils.degToRad(yaw);
      const pitchRad = THREE.MathUtils.degToRad(pitch);

      const dir = new THREE.Vector3(
        Math.cos(pitchRad) * Math.sin(yawRad),
        Math.sin(pitchRad),
        Math.cos(pitchRad) * Math.cos(yawRad)
      );

      const projected = dir.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;

      // Check if in front of camera
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const dot = dir.dot(camDir);

      if (dot > 0) {
        marker.style.display = 'flex';
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
      } else {
        marker.style.display = 'none';
      }
    });
  }

  function handleHotspotClick(hs) {
    if (hs.type === 'scene-link' && hs.targetSceneId) {
      loadScene(hs.targetSceneId);
    } else {
      showPopup(hs);
    }
  }

  function linkify(text) {
    return text.replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function showPopup(hs) {
    const container = document.getElementById('popupContainer');
    container.className = 'popup-overlay';
    let html = '<div class="popup">';
    html += '<button class="popup-close" onclick="document.getElementById(\\'popupContainer\\').className=\\'hidden\\'">&times;</button>';

    if (hs.type === 'image' && hs.imageUrl) {
      html += '<img class="popup-img" src="' + escapeAttr(hs.imageUrl) + '" alt="' + escapeAttr(hs.title) + '">';
    }

    html += '<div class="popup-body">';
    html += '<h3>' + escapeHTML(hs.title) + '</h3>';
    if (hs.description) {
      html += '<p>' + linkify(escapeHTML(hs.description)) + '</p>';
    }
    if (hs.type === 'content' && hs.content) {
      html += '<div>' + hs.content + '</div>';
    }
    if (hs.type === 'scene-link' && hs.targetSceneId) {
      html += '<button class="popup-nav-btn" onclick="window.__loadScene(\\''+hs.targetSceneId+'\\')">Navigate</button>';
    }
    html += '</div></div>';
    container.innerHTML = html;
  }

  function closePopup() {
    const container = document.getElementById('popupContainer');
    if (container) container.className = 'hidden';
  }

  window.__loadScene = function(id) { loadScene(id); };

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function animate() {
    requestAnimationFrame(animate);
    lat = Math.max(-85, Math.min(85, lat));
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );
    renderer.render(scene, camera);
    updateHotspotPositions();
  }
})();
<\/script>
</body>
</html>`
}

function generateReadme(tour: Tour): string {
  const sceneList = tour.scenes.map((s, i) => `${i + 1}. **${s.name}** - ${s.hotspots.length} hotspot(s)`).join('\n')
  return `# ${tour.name}

${tour.description || 'A 360-degree virtual tour.'}

## How to View

### Option 1: Open locally
Simply open \`index.html\` in any modern browser (Chrome, Firefox, Safari, Edge).

### Option 2: Host on GitHub Pages
1. Create a new GitHub repository
2. Upload all files from this ZIP to the repository
3. Go to **Settings > Pages** and set the source to the \`main\` branch
4. Your tour will be live at \`https://YOUR-USERNAME.github.io/REPO-NAME/\`

### Option 3: Host anywhere
Upload these files to any static hosting service (Netlify, Vercel, etc.) - no server required.

## Tour Contents

**Scenes:**
${sceneList}

## Files

- \`index.html\` - Self-contained tour viewer (loads Three.js from CDN)
- \`data/tour.json\` - Tour configuration and hotspot data
- \`images/\` - All panorama and hotspot images
- \`.nojekyll\` - Required for GitHub Pages compatibility

---
*Created with [PanoraVista](https://panoravista.vercel.app)*
`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Export a tour as a self-contained ZIP file.
 * Contains: index.html, data/tour.json, images/scenes/*, images/hotspots/*
 */
export async function exportTourAsZip(
  tour: Tour,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip()

  // Clone tour data — we'll rewrite image paths to relative
  const tourCopy: Tour = JSON.parse(JSON.stringify(tour))

  // Collect all images to download
  const imageJobs: { url: string; zipPath: string; apply: (path: string) => void }[] = []

  tourCopy.scenes.forEach((scene, i) => {
    const sceneName = sanitizeFilename(scene.name) || `scene-${i}`
    const ext = getExtension(scene.imageUrl)
    const zipPath = `images/scenes/${sceneName}.${ext}`

    imageJobs.push({
      url: scene.imageUrl,
      zipPath,
      apply: (path) => { scene.imageUrl = path },
    })

    scene.hotspots.forEach((hs, j) => {
      if (hs.imageUrl) {
        const hsExt = getExtension(hs.imageUrl)
        const hsPath = `images/hotspots/${sceneName}-hs-${j}.${hsExt}`
        imageJobs.push({
          url: hs.imageUrl,
          zipPath: hsPath,
          apply: (path) => { hs.imageUrl = path },
        })
      }
    })
  })

  // Download images
  const total = imageJobs.length
  for (let i = 0; i < imageJobs.length; i++) {
    const job = imageJobs[i]
    onProgress?.({
      phase: 'downloading',
      current: i + 1,
      total,
      label: `Downloading image ${i + 1}/${total}...`,
    })

    const blob = await downloadImage(job.url)
    if (blob) {
      zip.file(job.zipPath, blob)
      job.apply(job.zipPath)
    }
    // If download fails, keep the original URL in tour.json
  }

  // Package phase
  onProgress?.({
    phase: 'packaging',
    current: 0,
    total: 0,
    label: 'Packaging ZIP...',
  })

  // Add tour.json
  zip.file('data/tour.json', JSON.stringify(tourCopy, null, 2))

  // Add standalone HTML viewer
  zip.file('index.html', generateStandaloneHTML(tourCopy))

  // GitHub Pages: add .nojekyll so _-prefixed files aren't ignored
  zip.file('.nojekyll', '')

  // Add a simple README
  zip.file('README.md', generateReadme(tourCopy))

  // Generate ZIP
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  onProgress?.({
    phase: 'done',
    current: total,
    total,
    label: 'Export complete!',
  })

  return blob
}

/**
 * Import a tour from a previously exported ZIP file.
 * Extracts tour.json and converts image paths to blob URLs.
 */
export async function importTourFromZip(file: File): Promise<Tour | null> {
  try {
    const zip = await JSZip.loadAsync(file)

    // Find tour.json
    const tourFile = zip.file('data/tour.json')
    if (!tourFile) return null

    const tourJson = await tourFile.async('string')
    const tour: Tour = JSON.parse(tourJson)
    if (!tour.id || !tour.scenes) return null

    // Convert relative image paths to blob URLs
    for (const scene of tour.scenes) {
      const sceneImageFile = zip.file(scene.imageUrl)
      if (sceneImageFile) {
        const blob = await sceneImageFile.async('blob')
        scene.imageUrl = URL.createObjectURL(blob)
      }

      for (const hs of scene.hotspots) {
        if (hs.imageUrl) {
          const hsFile = zip.file(hs.imageUrl)
          if (hsFile) {
            const blob = await hsFile.async('blob')
            hs.imageUrl = URL.createObjectURL(blob)
          }
        }
      }
    }

    return tour
  } catch {
    return null
  }
}
