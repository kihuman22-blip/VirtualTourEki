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
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'pdf'].includes(ext)) {
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
  const iconSize = tour.settings?.iconSize ?? 40
  const iconSizeArrow = iconSize + 4
  const svgSize = Math.round(iconSize * 0.4)
  const svgSizeArrow = Math.round(iconSizeArrow * 0.45)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>${escapeHtml(tour.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; -webkit-tap-highlight-color: transparent; }
  #viewer { width: 100vw; height: 100vh; height: 100dvh; position: relative; touch-action: none; -webkit-user-select: none; user-select: none; }
  canvas { display: block; touch-action: none; }

  .overlay { position: absolute; z-index: 10; pointer-events: none; }
  .overlay > * { pointer-events: auto; }

  .top-bar {
    top: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(to bottom, rgba(10,10,10,0.7), transparent);
    transition: opacity 0.3s ease-out;
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
    transition: opacity 0.3s ease-out;
  }

  .scene-btn {
    background: rgba(30,30,30,0.8); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
    padding: 6px 12px; color: #fff; font-size: 12px; cursor: pointer;
    transition: background 0.2s;
  }
  .scene-btn:hover { background: rgba(50,50,50,0.9); }
  .scene-btn.active { border-color: #4db8a4; color: #4db8a4; }

  /* Hotspot markers - with pin stem design */
  .hotspot-wrap {
    position: absolute; top: 0; left: 0;
    display: flex; flex-direction: column; align-items: center;
    pointer-events: auto; cursor: pointer;
    will-change: transform; transition: opacity 0.15s ease-out;
    opacity: 0; z-index: 10;
  }
  .hotspot-icon {
    width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid rgba(255,255,255,0.5);
    box-shadow: 0 2px 12px rgba(0,0,0,0.35);
    transition: transform 0.2s;
  }
  .hotspot-wrap:hover .hotspot-icon { transform: scale(1.12); }
  .hotspot-icon svg { width: ${svgSize}px; height: ${svgSize}px; fill: none; stroke: #fff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .hotspot-icon.arrow-icon {
    width: ${iconSizeArrow}px; height: ${iconSizeArrow}px;
  }
  .hotspot-icon.arrow-icon svg { width: ${svgSizeArrow}px; height: ${svgSizeArrow}px; }
  .pin-stem { width: 2px; height: 10px; background: rgba(255,255,255,0.7); border-radius: 1px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  .pin-stem.short { height: 8px; }
  .hotspot-label { margin-top: 2px; padding: 1px 8px; border-radius: 4px; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); white-space: nowrap; font-size: 10px; font-weight: 500; }

  /* Popup */
  .popup-overlay {
    position: absolute; inset: 0; z-index: 20;
    display: flex; align-items: center; justify-content: center;
    padding: 8px;
  }
  .popup {
    background: #1a1a1a; border-radius: 12px;
    box-shadow: 0 8px 50px rgba(0,0,0,0.5);
    max-height: 90vh; overflow-y: auto;
    position: relative; animation: popIn 0.2s ease-out;
    display: flex; flex-direction: column;
  }
  .popup.portrait { width: min(90vw, 22rem); }
  .popup.landscape { width: min(95vw, 40rem); }
  .popup.square { width: min(90vw, 28rem); }
  .popup.pdf-popup { width: min(95vw, 48rem); }
  .popup.default-popup { width: min(90vw, 28rem); min-width: 200px; }
  @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .popup-close {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(0,0,0,0.4); border: none; color: rgba(255,255,255,0.7);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .popup-close:hover { color: #fff; background: rgba(0,0,0,0.6); }
  .popup-img { width: 100%; height: auto; object-fit: contain; background: #000; display: block; }
  .popup-img.portrait { max-height: 60vh; }
  .popup-img.landscape { max-height: 50vh; }
  .popup-img.square { max-height: 55vh; }
  .popup-pdf { width: 100%; height: 55vh; border: 0; flex-shrink: 0; background: #222; }
  .popup-body { padding: 16px; padding-right: 44px; }
  .popup-body h3 { font-size: 15px; font-weight: 500; margin-bottom: 6px; }
  .popup-body p { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .popup-body a { color: #60a5fa; text-decoration: underline; }
  .popup-pdf-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 12px; color: #60a5fa; text-decoration: none; }
  .popup-pdf-link:hover { color: #93bbfd; }
  
  /* Image carousel */
  .popup-img-container { position: relative; width: 100%; background: #000; }
  .popup-carousel-btn {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
    border: none; color: rgba(255,255,255,0.8); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, color 0.2s;
  }
  .popup-carousel-btn:hover { background: rgba(0,0,0,0.7); color: #fff; }
  .popup-carousel-btn.prev { left: 8px; }
  .popup-carousel-btn.next { right: 8px; }
  .popup-carousel-btn svg { width: 24px; height: 24px; }
  .popup-img-counter {
    position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
    padding: 4px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.9);
  }
  
  .popup-nav-btn {
    display: block; width: 100%; margin-top: 16px; padding: 10px;
    background: #fff; color: #000; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; cursor: pointer; text-align: center;
  }
  .popup-nav-btn:hover { background: rgba(255,255,255,0.9); }
  .hidden { display: none !important; }

  /* Responsive */
  @media (max-width: 640px) {
    .top-bar { padding: 8px 10px; }
    .tour-title { font-size: 12px; padding: 4px 8px; }
    .bottom-bar { padding: 10px; gap: 4px; padding-top: 40px; }
    .scene-btn { font-size: 11px; padding: 4px 8px; }
    .popup { border-radius: 10px; }
    .popup.portrait, .popup.landscape, .popup.square, .popup.default-popup { width: 95vw; }
    .popup-body { padding: 12px; padding-right: 40px; }
    .popup-body h3 { font-size: 14px; }
    .popup-body p { font-size: 12px; }
    .popup-pdf { height: 45vh; }
  }
</style>
</head>
<body>
<div id="viewer">
  <div class="overlay top-bar">
    <div class="tour-title" id="tourTitle"></div>
  </div>
  <div class="overlay bottom-bar" id="sceneBar"></div>
  <div id="hotspotLayer" style="transition: opacity 0.3s ease-out;"></div>
  <div id="popupContainer" class="hidden"></div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
(function() {
  var tourData = null;
  var currentSceneId = null;
  var camera, scene, renderer, sphere;
  var isUserInteracting = false;
  var lon = 0, lat = 0;
  var fov = 75;
  var tempVec = null;

  // Complete icon SVG map matching all 15 icon types
  var ICON_SVGS = {
    'arrow': '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    'info': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    'image': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    'link': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    'eye': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
    'utensils': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
    'menu': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 11h8"/><path d="M8 7h6"/></svg>',
    'chef': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg>',
    'wine': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>',
    'coffee': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>',
    'star': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'heart': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'map-pin': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
    'phone': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    'clock': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  };

  function getIconSvg(hs) {
    if (hs.icon && ICON_SVGS[hs.icon]) return ICON_SVGS[hs.icon];
    if (hs.type === 'scene-link') return ICON_SVGS['arrow'];
    if (hs.type === 'image') return ICON_SVGS['image'];
    return ICON_SVGS['info'];
  }

  // Scene name lookup
  var sceneNameMap = {};

  // Load tour data
  fetch('data/tour.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      tourData = data;
      document.getElementById('tourTitle').textContent = data.name;
      fov = data.settings && data.settings.defaultFov ? data.settings.defaultFov : 75;
      data.scenes.forEach(function(s) { sceneNameMap[s.id] = s.name; });
      initThree();
      buildSceneBar();
      loadScene(data.startSceneId || data.scenes[0].id);
      animate();
    })
    .catch(function(err) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;"><h2>Error loading tour</h2><p>' + err.message + '</p></div>';
    });

  function initThree() {
    var container = document.getElementById('viewer');
    var isMobile = window.innerWidth < 768;
    camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1100);
    scene = new THREE.Scene();
    tempVec = new THREE.Vector3();

    // Higher segment count for smoother sphere and maximum quality
    var segments = isMobile ? 128 : 256;
    var rings = isMobile ? 96 : 192;
    var geometry = new THREE.SphereGeometry(500, segments, rings);
    geometry.scale(-1, 1, 1);
    var material = new THREE.MeshBasicMaterial();
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    // Use full device pixel ratio for maximum sharpness
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.insertBefore(renderer.domElement, container.firstChild);

    // Controls -- touch + mouse with delta-based movement
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    // Prevent native scrolling / pull-to-refresh on mobile
    container.addEventListener('touchmove', function(e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('resize', onResize);
  }

  var dragPointerId = -1;
  var lastX = 0, lastY = 0;
  var velLon = 0, velLat = 0;
  var smoothVelLon = 0, smoothVelLat = 0;
  var targetLon = 0, targetLat = 0;
  var displayLon = 0, displayLat = 0;
  var pointers = {};
  var pinchActive = false, pinchInitDist = 0, pinchInitFov = 75;

  function onPointerDown(e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var numPointers = Object.keys(pointers).length;

    if (e.target.closest('.overlay, .hotspot-wrap, .popup-overlay, #popupContainer')) return;

    // Two-finger pinch
    if (numPointers === 2) {
      var pts = Object.values(pointers);
      var dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchActive = true;
      pinchInitDist = dist;
      pinchInitFov = fov;
      velLon = 0; velLat = 0;
      smoothVelLon = 0; smoothVelLat = 0;
      return;
    }

    // Single finger / mouse drag
    if (numPointers === 1) {
      isUserInteracting = true;
      dragPointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      velLon = 0; velLat = 0;
      smoothVelLon = 0; smoothVelLat = 0;
    }
  }
  function onPointerMove(e) {
    if (pointers[e.pointerId]) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    }
    var numPointers = Object.keys(pointers).length;

    // Pinch zoom
    if (pinchActive && numPointers === 2) {
      var pts = Object.values(pointers);
      var dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      var scale = pinchInitDist / dist;
      fov = Math.max(30, Math.min(100, pinchInitFov * scale));
      camera.fov = fov;
      camera.updateProjectionMatrix();
      return;
    }

    if (!isUserInteracting || e.pointerId !== dragPointerId) return;

    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    var sens = 0.18 * (fov / 75);
    targetLon -= dx * sens;
    targetLat += dy * sens;

    // Smooth velocity tracking for momentum
    smoothVelLon = smoothVelLon * 0.85 + (dx * sens) * 0.15;
    smoothVelLat = smoothVelLat * 0.85 + (dy * sens) * 0.15;
  }
  function onPointerUp(e) {
    delete pointers[e.pointerId];
    var numPointers = Object.keys(pointers).length;
    if (numPointers < 2) pinchActive = false;

    // If the primary drag pointer was released
    if (e.pointerId === dragPointerId) {
      // If one finger remains after pinch, continue dragging with it
      if (numPointers === 1) {
        var remainId = Object.keys(pointers)[0];
        dragPointerId = parseInt(remainId);
        lastX = pointers[remainId].x;
        lastY = pointers[remainId].y;
        return;
      }
      isUserInteracting = false;
      dragPointerId = -1;
      // Transfer smoothed velocity for gentle momentum
      var maxM = 1.0;
      velLon = Math.max(-maxM, Math.min(maxM, smoothVelLon));
      velLat = Math.max(-maxM, Math.min(maxM, smoothVelLat));
      smoothVelLon = 0; smoothVelLat = 0;
    }
  }
  function onWheel(e) {
    e.preventDefault();
    targetFov = Math.max(30, Math.min(100, targetFov + e.deltaY * 0.05));
  }
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  var sceneLoaded = false;
  
  function loadScene(sceneId) {
    var sceneData = null;
    for (var i = 0; i < tourData.scenes.length; i++) {
      if (tourData.scenes[i].id === sceneId) { sceneData = tourData.scenes[i]; break; }
    }
    if (!sceneData) return;
    currentSceneId = sceneId;
    sceneLoaded = false;
    
    // Hide hotspots and UI until scene is loaded
    var layer = document.getElementById('hotspotLayer');
    var topBar = document.querySelector('.top-bar');
    var bottomBar = document.querySelector('.bottom-bar');
    if (layer) layer.style.opacity = '0';
    if (topBar) topBar.style.opacity = '0';
    if (bottomBar) bottomBar.style.opacity = '0';

    // Set initial view
    if (sceneData.initialViewDirection) {
      lon = sceneData.initialViewDirection.yaw || 0;
      lat = sceneData.initialViewDirection.pitch || 0;
      targetLon = lon; targetLat = lat;
      displayLon = lon; displayLat = lat;
    }

    // Load texture with high quality settings
    var loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(sceneData.imageUrl, function(texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      // High quality texture filtering
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      // Maximum anisotropic filtering for sharper textures at angles
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      sphere.material.map = texture;
      sphere.material.needsUpdate = true;
      
      // Show UI after texture is loaded
      sceneLoaded = true;
      setTimeout(function() {
        var layer = document.getElementById('hotspotLayer');
        var topBar = document.querySelector('.top-bar');
        var bottomBar = document.querySelector('.bottom-bar');
        if (layer) layer.style.opacity = '1';
        if (topBar) topBar.style.opacity = '1';
        if (bottomBar) bottomBar.style.opacity = '1';
      }, 50);
    });

    // Update scene bar active state
    var btns = document.querySelectorAll('.scene-btn');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.toggle('active', btns[b].dataset.id === sceneId);
    }

    closePopup();
    renderHotspots(sceneData);
  }

  function buildSceneBar() {
    var bar = document.getElementById('sceneBar');
    bar.innerHTML = '';
    tourData.scenes.forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'scene-btn';
      btn.dataset.id = s.id;
      btn.textContent = s.name;
      btn.onclick = function() { loadScene(s.id); };
      bar.appendChild(btn);
    });
  }

  function renderHotspots(sceneData) {
    var layer = document.getElementById('hotspotLayer');
    layer.innerHTML = '';
    sceneData.hotspots.forEach(function(hs) {
      var wrap = document.createElement('div');
      wrap.className = 'hotspot-wrap';
      wrap.dataset.yaw = hs.position.yaw;
      wrap.dataset.pitch = hs.position.pitch;
      wrap.dataset.id = hs.id;

      var isArrow = hs.type === 'scene-link';
      var color = hs.color || (isArrow ? '#4db8a4' : '#f59e0b');

      // Icon circle
      var icon = document.createElement('div');
      icon.className = 'hotspot-icon' + (isArrow ? ' arrow-icon' : '');
      icon.style.background = color + 'cc';
      icon.innerHTML = getIconSvg(hs);
      wrap.appendChild(icon);

      // Pin stem
      var stem = document.createElement('div');
      stem.className = 'pin-stem' + (isArrow ? '' : ' short');
      wrap.appendChild(stem);

      // Label
      var targetName = isArrow && hs.targetSceneId ? sceneNameMap[hs.targetSceneId] : null;
      var labelText = targetName || hs.title;
      if (labelText) {
        var label = document.createElement('div');
        label.className = 'hotspot-label';
        label.textContent = labelText;
        wrap.appendChild(label);
      }

      wrap.onclick = function() { handleHotspotClick(hs); };
      layer.appendChild(wrap);
    });
  }

  function yawPitchToVec3(yaw, pitch, radius) {
    var yr = yaw * Math.PI / 180;
    var pr = pitch * Math.PI / 180;
    return {
      x: radius * Math.cos(pr) * Math.sin(yr),
      y: radius * Math.sin(pr),
      z: radius * Math.cos(pr) * Math.cos(yr)
    };
  }

  function updateHotspotPositions() {
    var layer = document.getElementById('hotspotLayer');
    if (!layer) return;
    var markers = layer.querySelectorAll('.hotspot-wrap');
    var w = window.innerWidth;
    var h = window.innerHeight;

    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      var yaw = parseFloat(marker.dataset.yaw);
      var pitch = parseFloat(marker.dataset.pitch);
      var p = yawPitchToVec3(yaw, pitch, 480);
      tempVec.set(p.x, p.y, p.z).project(camera);

      if (tempVec.z < 1) {
        var x = (tempVec.x * 0.5 + 0.5) * w;
        var y = (-tempVec.y * 0.5 + 0.5) * h;
        var depth = Math.max(0.5, Math.abs(tempVec.z));
        var scale = Math.max(0.7, Math.min(1.1, 1.0 / depth));
        marker.style.transform = 'translate(' + x + 'px, ' + y + 'px) translate(-50%, -50%) scale(' + scale.toFixed(3) + ')';
        marker.style.opacity = '1';
      } else {
        marker.style.opacity = '0';
      }
    }
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

  var currentPopupImages = [];
  var currentPopupImageIndex = 0;

  function showPopup(hs) {
    var container = document.getElementById('popupContainer');
    container.className = 'popup-overlay';

    // Determine popup class based on content
    var popupClass = 'popup default-popup';
    var imgClass = '';
    var hasPdf = hs.pdfUrl && hs.pdfUrl.length > 0;
    
    // Collect all images (images array + imageUrl fallback)
    var allImages = [];
    if (hs.images && hs.images.length > 0) {
      allImages = hs.images.slice();
    }
    if (hs.imageUrl && allImages.indexOf(hs.imageUrl) === -1) {
      allImages.unshift(hs.imageUrl);
    }
    var hasImage = (hs.type === 'image' || hs.type === 'info') && allImages.length > 0;
    var hasMultipleImages = allImages.length > 1;
    
    currentPopupImages = allImages;
    currentPopupImageIndex = 0;

    if (hasPdf) {
      popupClass = 'popup pdf-popup';
    }

    var html = '<div class="' + popupClass + '" id="popupInner">';
    html += '<button class="popup-close" onclick="document.getElementById(\\'popupContainer\\').className=\\'hidden\\'">&times;</button>';

    if (hasImage) {
      html += '<div class="popup-img-container">';
      html += '<img class="popup-img" id="popupImg" src="' + escapeAttr(allImages[0]) + '" alt="' + escapeAttr(hs.title) + '" onload="adaptPopup(this)">';
      
      if (hasMultipleImages) {
        html += '<button class="popup-carousel-btn prev" onclick="window.__prevImage()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>';
        html += '<button class="popup-carousel-btn next" onclick="window.__nextImage()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>';
        html += '<div class="popup-img-counter" id="imgCounter">1 / ' + allImages.length + '</div>';
      }
      
      html += '</div>';
    }

    if (hasPdf) {
      html += '<iframe class="popup-pdf" src="' + escapeAttr(hs.pdfUrl) + '" title="PDF"></iframe>';
    }

    html += '<div class="popup-body">';
    html += '<h3>' + escapeHTML(hs.title) + '</h3>';
    if (hs.description) {
      html += '<p>' + linkify(escapeHTML(hs.description)) + '</p>';
    }
    if (hs.type === 'content' && hs.content) {
      html += '<div>' + hs.content + '</div>';
    }
    if (hasPdf) {
      html += '<a class="popup-pdf-link" href="' + escapeAttr(hs.pdfUrl) + '" target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF herunterladen</a>';
    }
    if (hs.type === 'scene-link' && hs.targetSceneId) {
      html += '<button class="popup-nav-btn" onclick="window.__loadScene(\\''+hs.targetSceneId+'\\')">Navigate</button>';
    }
    html += '</div></div>';
    container.innerHTML = html;
  }

  // Adaptive popup sizing based on image orientation
  window.adaptPopup = function(img) {
    var popup = document.getElementById('popupInner');
    if (!popup || !img) return;
    var ratio = img.naturalWidth / img.naturalHeight;
    // Remove default class
    popup.classList.remove('default-popup');
    if (ratio < 0.85) {
      popup.classList.add('portrait');
      img.classList.add('portrait');
    } else if (ratio > 1.15) {
      popup.classList.add('landscape');
      img.classList.add('landscape');
    } else {
      popup.classList.add('square');
      img.classList.add('square');
    }
  };

  function closePopup() {
    var container = document.getElementById('popupContainer');
    if (container) container.className = 'hidden';
  }

  window.__loadScene = function(id) { loadScene(id); };
  
  window.__prevImage = function() {
    if (currentPopupImages.length <= 1) return;
    currentPopupImageIndex = (currentPopupImageIndex - 1 + currentPopupImages.length) % currentPopupImages.length;
    updateCarouselImage();
  };
  
  window.__nextImage = function() {
    if (currentPopupImages.length <= 1) return;
    currentPopupImageIndex = (currentPopupImageIndex + 1) % currentPopupImages.length;
    updateCarouselImage();
  };
  
  function updateCarouselImage() {
    var img = document.getElementById('popupImg');
    var counter = document.getElementById('imgCounter');
    if (img) {
      img.src = currentPopupImages[currentPopupImageIndex];
    }
    if (counter) {
      counter.textContent = (currentPopupImageIndex + 1) + ' / ' + currentPopupImages.length;
    }
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  var lastFrameTime = 0;
  var targetFov = 75;
  function animate(now) {
    requestAnimationFrame(animate);
    var dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
    lastFrameTime = now;
    dt = Math.min(dt, 0.1); // clamp for tab-switch

    // Apply momentum when not dragging
    if (!isUserInteracting) {
      var friction = Math.exp(-dt * 3);
      velLon *= friction;
      velLat *= friction;
      if (Math.abs(velLon) < 0.0005) velLon = 0;
      if (Math.abs(velLat) < 0.0005) velLat = 0;
      targetLon -= velLon * dt * 60;
      targetLat += velLat * dt * 60;
    }

    targetLat = Math.max(-85, Math.min(85, targetLat));

    // Smooth interpolation towards target
    var smoothF = 1 - Math.exp(-dt * 14);
    displayLon += (targetLon - displayLon) * smoothF;
    displayLat += (targetLat - displayLat) * smoothF;

    lat = displayLat;
    lon = displayLon;

    // Smooth FOV
    var fovDiff = targetFov - camera.fov;
    if (Math.abs(fovDiff) > 0.01) {
      camera.fov += fovDiff * (1 - Math.exp(-dt * 10));
      camera.updateProjectionMatrix();
    }

    var phi = THREE.MathUtils.degToRad(90 - lat);
    var theta = THREE.MathUtils.degToRad(lon);
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
- \`files/\` - PDF attachments (if any)
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
 * Contains: index.html, data/tour.json, images/scenes/*, images/hotspots/*, files/*
 */
export async function exportTourAsZip(
  tour: Tour,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip()

  // Clone tour data — we'll rewrite image paths to relative
  const tourCopy: Tour = JSON.parse(JSON.stringify(tour))

  // Collect all files to download (images + PDFs)
  const fileJobs: { url: string; zipPath: string; apply: (path: string) => void }[] = []

  tourCopy.scenes.forEach((scene, i) => {
    const sceneName = sanitizeFilename(scene.name) || `scene-${i}`
    const ext = getExtension(scene.imageUrl)
    const zipPath = `images/scenes/${sceneName}.${ext}`

    fileJobs.push({
      url: scene.imageUrl,
      zipPath,
      apply: (path) => { scene.imageUrl = path },
    })

    scene.hotspots.forEach((hs, j) => {
      // Export single imageUrl
      if (hs.imageUrl) {
        const hsExt = getExtension(hs.imageUrl)
        const hsPath = `images/hotspots/${sceneName}-hs-${j}.${hsExt}`
        fileJobs.push({
          url: hs.imageUrl,
          zipPath: hsPath,
          apply: (path) => { hs.imageUrl = path },
        })
      }
      
      // Export images array (multiple images for carousel)
      if (hs.images && hs.images.length > 0) {
        hs.images.forEach((imgUrl, imgIndex) => {
          const imgExt = getExtension(imgUrl)
          const imgPath = `images/hotspots/${sceneName}-hs-${j}-img-${imgIndex}.${imgExt}`
          fileJobs.push({
            url: imgUrl,
            zipPath: imgPath,
            apply: (path) => { 
              if (hs.images) hs.images[imgIndex] = path 
            },
          })
        })
      }
      
      if (hs.pdfUrl) {
        const pdfPath = `files/${sceneName}-hs-${j}.pdf`
        fileJobs.push({
          url: hs.pdfUrl,
          zipPath: pdfPath,
          apply: (path) => { hs.pdfUrl = path },
        })
      }
    })
  })

  // Download all files
  const total = fileJobs.length
  for (let i = 0; i < fileJobs.length; i++) {
    const job = fileJobs[i]
    onProgress?.({
      phase: 'downloading',
      current: i + 1,
      total,
      label: `Downloading file ${i + 1}/${total}...`,
    })

    const blob = await downloadImage(job.url)
    if (blob) {
      // Store images without re-compression to preserve original quality
      const isImage = /\.(jpe?g|png|webp|avif|gif)$/i.test(job.zipPath)
      zip.file(job.zipPath, blob, {
        compression: isImage ? 'STORE' : 'DEFLATE',
      })
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

    // Convert relative paths to blob URLs
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
        
        // Import images array (multiple images for carousel)
        if (hs.images && hs.images.length > 0) {
          for (let imgIndex = 0; imgIndex < hs.images.length; imgIndex++) {
            const imgFile = zip.file(hs.images[imgIndex])
            if (imgFile) {
              const blob = await imgFile.async('blob')
              hs.images[imgIndex] = URL.createObjectURL(blob)
            }
          }
        }
        
        if (hs.pdfUrl) {
          const pdfFile = zip.file(hs.pdfUrl)
          if (pdfFile) {
            const blob = await pdfFile.async('blob')
            hs.pdfUrl = URL.createObjectURL(blob)
          }
        }
      }
    }

    return tour
  } catch {
    return null
  }
}
