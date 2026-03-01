"use client"

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import type { Scene, Hotspot, HotspotPosition } from '@/lib/tour-types'
import { yawPitchToVector3, vector3ToYawPitch } from '@/lib/tour-types'

interface PanoramaViewerProps {
  scene: Scene
  fov?: number
  autoRotate?: boolean
  autoRotateSpeed?: number
  iconSize?: number
  onHotspotClick?: (hotspot: Hotspot) => void
  onHotspotMoved?: (hotspotId: string, newPosition: HotspotPosition) => void
  onSceneClick?: (position: HotspotPosition) => void
  onDropScene?: (sceneId: string, position: HotspotPosition) => void
  isEditorMode?: boolean
  selectedHotspotId?: string | null
  className?: string
  allScenes?: Scene[]
}

export default function PanoramaViewer({
  scene,
  fov = 75,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  iconSize = 40,
  onHotspotClick,
  onHotspotMoved,
  onSceneClick,
  onDropScene,
  isEditorMode = false,
  selectedHotspotId,
  className = '',
  allScenes,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const threeSceneRef = useRef<THREE.Scene | null>(null)
  const sphereRef = useRef<THREE.Mesh | null>(null)
  const currentTextureRef = useRef<THREE.Texture | null>(null)
  const frameIdRef = useRef<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDragOverViewer, setIsDragOverViewer] = useState(false)

  // Camera state
  const rotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })
  const targetRotationRef = useRef({ yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch })

  // Momentum / inertia for smooth touch feel
  const velocityRef = useRef({ yaw: 0, pitch: 0 })

  // Pointer tracking
  const pointerState = useRef<{
    mode: 'none' | 'camera' | 'hotspot'
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
    hotspotId: string | null
    hotspotStartYaw: number
    hotspotStartPitch: number
    pointerId: number
  }>({ mode: 'none', startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false, hotspotId: null, hotspotStartYaw: 0, hotspotStartPitch: 0, pointerId: -1 })

  // Multi-touch pinch zoom tracking
  const pinchState = useRef<{
    active: boolean
    initialDist: number
    initialFov: number
    pointers: Map<number, { x: number; y: number }>
  }>({ active: false, initialDist: 0, initialFov: 75, pointers: new Map() })
  
  // Reusable raycaster for performance
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseVecRef = useRef(new THREE.Vector2())

  // DOM refs for direct hotspot positioning
  const hotspotElsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  // ---- Three.js init ----
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const isMobile = window.innerWidth < 768
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 1, 1100)
    cameraRef.current = camera

    const s = new THREE.Scene()
    threeSceneRef.current = s

    const geoSegments = isMobile ? 64 : 128
    const geoRings = isMobile ? 40 : 80
    const geo = new THREE.SphereGeometry(500, geoSegments, geoRings)
    geo.scale(-1, 1, 1)
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111 })
    const mesh = new THREE.Mesh(geo, mat)
    s.add(mesh)
    sphereRef.current = mesh

    return () => {
      cancelAnimationFrame(frameIdRef.current)
      renderer.dispose()
      geo.dispose()
      mat.dispose()
      if (currentTextureRef.current) currentTextureRef.current.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Load texture on scene change ----
  useEffect(() => {
    if (!sphereRef.current || !scene.imageUrl) return
    setIsLoading(true)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tex = new THREE.Texture(img)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = true
      if (rendererRef.current) tex.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy()
      tex.needsUpdate = true

      if (currentTextureRef.current) currentTextureRef.current.dispose()
      currentTextureRef.current = tex

      const newMat = new THREE.MeshBasicMaterial({ map: tex })
      if (sphereRef.current) {
        const old = sphereRef.current.material as THREE.MeshBasicMaterial
        sphereRef.current.material = newMat
        old.dispose()
      }
      setIsLoading(false)
    }
    img.onerror = () => setIsLoading(false)
    img.src = scene.imageUrl
  }, [scene.imageUrl, scene.id])

  // Reset view direction on scene change
  useEffect(() => {
    rotationRef.current = { yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch }
    targetRotationRef.current = { yaw: scene.initialViewDirection.yaw, pitch: scene.initialViewDirection.pitch }
  }, [scene.id, scene.initialViewDirection.yaw, scene.initialViewDirection.pitch])

  // ---- FOV ----
  useEffect(() => {
    if (cameraRef.current) { cameraRef.current.fov = fov; cameraRef.current.updateProjectionMatrix() }
  }, [fov])

  // ---- Animation loop ----
  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const ts = threeSceneRef.current
    const container = canvasContainerRef.current
    if (!renderer || !camera || !ts || !container) return

    let lastTime = performance.now()
    const tempVec = new THREE.Vector3()
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = (now - lastTime) / 1000
      lastTime = now

      if (pointerState.current.mode === 'none' && autoRotate) {
        targetRotationRef.current.yaw += autoRotateSpeed * dt * 10
      }

      // Apply momentum / inertia when finger is released
      if (pointerState.current.mode === 'none' && !autoRotate) {
        const vel = velocityRef.current
        if (Math.abs(vel.yaw) > 0.01 || Math.abs(vel.pitch) > 0.01) {
          targetRotationRef.current.yaw += vel.yaw
          targetRotationRef.current.pitch += vel.pitch
          // Friction: decay velocity
          const friction = Math.exp(-dt * 5)
          vel.yaw *= friction
          vel.pitch *= friction
        }
      }

      // Smooth camera interpolation - freeze during hotspot drag for stable raycast
      if (pointerState.current.mode !== 'hotspot') {
        // Exponential smoothing for silky smooth camera movement
        const smoothFactor = 1 - Math.exp(-dt * 25)
        rotationRef.current.yaw += (targetRotationRef.current.yaw - rotationRef.current.yaw) * smoothFactor
        rotationRef.current.pitch += (targetRotationRef.current.pitch - rotationRef.current.pitch) * smoothFactor
      } else {
        // During hotspot drag, snap camera instantly for precise raycast
        rotationRef.current.yaw = targetRotationRef.current.yaw
        rotationRef.current.pitch = targetRotationRef.current.pitch
      }
      rotationRef.current.pitch = Math.max(-85, Math.min(85, rotationRef.current.pitch))
      targetRotationRef.current.pitch = Math.max(-85, Math.min(85, targetRotationRef.current.pitch))

      const yr = THREE.MathUtils.degToRad(rotationRef.current.yaw)
      const pr = THREE.MathUtils.degToRad(rotationRef.current.pitch)
      camera.lookAt(Math.cos(pr) * Math.sin(yr) * 100, Math.sin(pr) * 100, Math.cos(pr) * Math.cos(yr) * 100)
      renderer.render(ts, camera)

      // Position hotspot elements directly in DOM - optimized for 60fps
      const w = container.clientWidth
      const h = container.clientHeight
      const hotspots = sceneRef.current.hotspots
      for (let i = 0; i < hotspots.length; i++) {
        const hs = hotspots[i]
        const el = hotspotElsRef.current.get(hs.id)
        if (!el) continue
        const p = yawPitchToVector3(hs.position.yaw, hs.position.pitch, 480)
        tempVec.set(p.x, p.y, p.z).project(camera)
        if (tempVec.z < 1) {
          const x = (tempVec.x * 0.5 + 0.5) * w
          const y = (-tempVec.y * 0.5 + 0.5) * h
          const depth = Math.max(0.5, Math.abs(tempVec.z))
          const baseScale = Math.max(0.7, Math.min(1.1, 1.0 / depth))
          // Gaze proximity: icons near center of screen get a subtle scale boost
          const cx = w / 2, cy = h / 2
          const distToCenter = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy))
          const maxDist = Math.min(w, h) * 0.35
          const proximity = Math.max(0, 1 - distToCenter / maxDist)
          // Subtle boost: up to 15% larger when directly looked at
          const gazeScale = 1 + proximity * 0.15
          const scale = baseScale * gazeScale
          // Use transform for GPU-accelerated positioning
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
          el.style.opacity = '1'
          el.style.zIndex = hs.id === selectedHotspotId ? '20' : '10'
        } else {
          el.style.opacity = '0'
        }
      }
    }
    animate()
    return () => cancelAnimationFrame(frameIdRef.current)
  }, [autoRotate, autoRotateSpeed, selectedHotspotId])

  // ---- Resize ----
  useEffect(() => {
    const container = canvasContainerRef.current
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!container || !renderer || !camera) return
    const obs = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  // ---- Helper: raycast screen coords to yaw/pitch (reuses objects for perf) ----
  const screenToYawPitch = useCallback((clientX: number, clientY: number): HotspotPosition | null => {
    const cont = canvasContainerRef.current
    const cam = cameraRef.current
    const sph = sphereRef.current
    if (!cont || !cam || !sph) return null
    
    const rect = cont.getBoundingClientRect()
    mouseVecRef.current.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycasterRef.current.setFromCamera(mouseVecRef.current, cam)
    const hits = raycasterRef.current.intersectObject(sph)
    if (hits.length > 0) {
      const pt = hits[0].point
      const yaw = (Math.atan2(-pt.x, pt.z) * 180) / Math.PI
      const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y + pt.z * pt.z)
      const pitch = (Math.asin(pt.y / r) * 180) / Math.PI
      return { yaw, pitch }
    }
    return null
  }, [])

  // ---- Unified pointer handling on the container ----
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Check if a hotspot element was the target
    const target = e.target as HTMLElement
    const hotspotEl = target.closest('[data-hotspot-id]') as HTMLElement | null

    if (hotspotEl && onHotspotMoved) {
      const hsId = hotspotEl.getAttribute('data-hotspot-id')!
      const hs = sceneRef.current.hotspots.find((h) => h.id === hsId)
      if (hs) {
        e.preventDefault()
        e.stopPropagation()
        pointerState.current = {
          mode: 'hotspot',
          startX: e.clientX, startY: e.clientY,
          lastX: e.clientX, lastY: e.clientY,
          moved: false,
          hotspotId: hsId,
          hotspotStartYaw: hs.position.yaw,
          hotspotStartPitch: hs.position.pitch,
          pointerId: e.pointerId,
        }
        containerRef.current?.setPointerCapture(e.pointerId)
        return
      }
    }

    // Camera drag -- reset velocity for fresh drag
    velocityRef.current = { yaw: 0, pitch: 0 }

    // Track pointer for pinch zoom
    pinchState.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // If two fingers are down, start pinch mode
    if (pinchState.current.pointers.size === 2) {
      const pts = Array.from(pinchState.current.pointers.values())
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      pinchState.current.active = true
      pinchState.current.initialDist = dist
      pinchState.current.initialFov = cameraRef.current?.fov || 75
    }

    pointerState.current = {
      mode: 'camera',
      startX: e.clientX, startY: e.clientY,
      lastX: e.clientX, lastY: e.clientY,
      moved: false,
      hotspotId: null,
      hotspotStartYaw: 0, hotspotStartPitch: 0,
      pointerId: e.pointerId,
    }
    containerRef.current?.setPointerCapture(e.pointerId)
  }, [onHotspotMoved])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ps = pointerState.current
    if (ps.mode === 'none') return

    // Update pinch pointer position
    if (pinchState.current.pointers.has(e.pointerId)) {
      pinchState.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    // Handle pinch zoom with two fingers
    if (pinchState.current.active && pinchState.current.pointers.size === 2) {
      const pts = Array.from(pinchState.current.pointers.values())
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const scale = pinchState.current.initialDist / dist
      const camera = cameraRef.current
      if (camera) {
        camera.fov = Math.max(30, Math.min(100, pinchState.current.initialFov * scale))
        camera.updateProjectionMatrix()
      }
      return // Don't process camera drag during pinch
    }

    const dx = e.clientX - ps.startX
    const dy = e.clientY - ps.startY
    // Very low threshold for instant drag detection
    if (!ps.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) ps.moved = true

    if (ps.mode === 'hotspot' && ps.moved && onHotspotMoved && ps.hotspotId) {
      // Delta-based movement: move hotspot relative to mouse movement
      // This gives precise 1:1 control like dragging an object
      const container = canvasContainerRef.current
      if (container) {
        const sensitivity = 0.35 // Degrees per pixel
        const moveDx = e.clientX - ps.lastX
        const moveDy = e.clientY - ps.lastY
        
        // Update the stored start position for continuous movement
        const hs = sceneRef.current.hotspots.find((h) => h.id === ps.hotspotId)
        if (hs) {
          // Move yaw based on horizontal mouse movement (inverted for natural feel)
          // Move pitch based on vertical mouse movement (inverted: drag down = arrow goes up)
          const newYaw = hs.position.yaw - moveDx * sensitivity
          const newPitch = Math.max(-85, Math.min(85, hs.position.pitch - moveDy * sensitivity))
          
          onHotspotMoved(ps.hotspotId, { yaw: newYaw, pitch: newPitch })
        }
        
        ps.lastX = e.clientX
        ps.lastY = e.clientY
      }
    }

    if (ps.mode === 'camera') {
      // Use manual delta from tracked coordinates for reliable touch + mouse support
      const moveDx = e.clientX - ps.lastX
      const moveDy = e.clientY - ps.lastY
      ps.lastX = e.clientX
      ps.lastY = e.clientY

      // Scale sensitivity based on FOV for consistent feel at all zoom levels
      const cam = cameraRef.current
      const fovScale = cam ? cam.fov / 75 : 1
      const sensitivity = 0.3 * fovScale

      const deltaYaw = moveDx * sensitivity
      const deltaPitch = moveDy * sensitivity

      targetRotationRef.current.yaw += deltaYaw
      targetRotationRef.current.pitch += deltaPitch

      // Track velocity for momentum/inertia on release
      velocityRef.current.yaw = deltaYaw
      velocityRef.current.pitch = deltaPitch
    }
  }, [onHotspotMoved])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const ps = pointerState.current
    containerRef.current?.releasePointerCapture(e.pointerId)

    // Clean up pinch state
    pinchState.current.pointers.delete(e.pointerId)
    if (pinchState.current.pointers.size < 2) {
      pinchState.current.active = false
    }

    if (ps.mode === 'hotspot') {
      // No momentum for hotspot drags
      velocityRef.current = { yaw: 0, pitch: 0 }
      if (!ps.moved && onHotspotClick) {
        const hs = sceneRef.current.hotspots.find((h) => h.id === ps.hotspotId)
        if (hs) onHotspotClick(hs)
      }
    }

    if (ps.mode === 'camera' && !ps.moved) {
      // Click on panorama -- place hotspot or click hotspot
      const target = e.target as HTMLElement
      const hotspotEl = target.closest('[data-hotspot-id]') as HTMLElement | null
      if (hotspotEl && onHotspotClick && !onHotspotMoved) {
        const hsId = hotspotEl.getAttribute('data-hotspot-id')!
        const hs = sceneRef.current.hotspots.find((h) => h.id === hsId)
        if (hs) onHotspotClick(hs)
      } else if (isEditorMode && onSceneClick) {
        const pos = screenToYawPitch(e.clientX, e.clientY)
        if (pos) onSceneClick(pos)
      }
    }

    pointerState.current = { mode: 'none', startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false, hotspotId: null, hotspotStartYaw: 0, hotspotStartPitch: 0, pointerId: -1 }
  }, [isEditorMode, onSceneClick, onHotspotClick, onHotspotMoved, screenToYawPitch])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const camera = cameraRef.current
    if (!camera) return
    camera.fov = Math.max(30, Math.min(100, camera.fov + e.deltaY * 0.05))
    camera.updateProjectionMatrix()
  }, [])

  // ---- Drag & drop ----
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-scene-id')) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setIsDragOverViewer(true) }
  }, [])
  const onDragLeave = useCallback(() => setIsDragOverViewer(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOverViewer(false)
    const sid = e.dataTransfer.getData('application/x-scene-id')
    if (!sid || !onDropScene) return
    const pos = screenToYawPitch(e.clientX, e.clientY)
    if (pos) onDropScene(sid, pos)
  }, [onDropScene, screenToYawPitch])

  const setHotspotRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) hotspotElsRef.current.set(id, el); else hotspotElsRef.current.delete(id)
  }, [])

  const canDrag = !!onHotspotMoved

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{ touchAction: 'none', cursor: pointerState.current.mode === 'camera' ? 'grabbing' : (isEditorMode ? 'crosshair' : 'grab') }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Three.js canvas */}
      <div ref={canvasContainerRef} className="absolute inset-0" />

      {/* Hotspot overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {scene.hotspots.map((hotspot) => {
          const isSelected = hotspot.id === selectedHotspotId
          const targetScene = allScenes?.find((s) => s.id === hotspot.targetSceneId)

          return (
            <div
              key={hotspot.id}
              ref={(el) => setHotspotRef(hotspot.id, el)}
              data-hotspot-id={hotspot.id}
              className="absolute top-0 left-0 pointer-events-auto"
              style={{ opacity: 0, willChange: 'transform', transition: 'opacity 0.15s ease-out, transform 0.15s ease-out' }}
            >
              {hotspot.type === 'scene-link' ? (
                <div className={`flex flex-col items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} group/arrow`}>
                  {/* Arrow icon with pin stem */}
                  <div
                    className={`relative flex items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover/arrow:scale-[1.15] ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50' : ''}`}
                    style={{
                      width: iconSize + 4, height: iconSize + 4,
                      background: hotspot.color || '#4db8a4',
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    <svg width={iconSize * 0.45} height={iconSize * 0.45} viewBox="0 0 24 24" fill="none">
                      <path d="M6 15l6-6 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {/* Pin stem */}
                  <div className="w-0.5 h-3 bg-white/70 rounded-full" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                  {targetScene && (
                    <div className="mt-1 px-2.5 py-0.5 rounded bg-black/70 backdrop-blur-sm whitespace-nowrap">
                      <span className="text-[10px] font-medium text-white">{targetScene.name}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} group/hs`}>
                  {/* Icon with pin stem - orange/amber style */}
                  <div
                    className={`flex items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover/hs:scale-[1.15] ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50' : ''}`}
                    style={{
                      width: iconSize, height: iconSize,
                      background: hotspot.color || '#f59e0b',
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    {(() => {
                      const icoSz = Math.round(iconSize * 0.4)
                      const svgProps = { width: icoSz, height: icoSz, viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
                      if (hotspot.icon === 'eye') return <svg {...svgProps}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                      if (hotspot.icon === 'link') return <svg {...svgProps}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      if (hotspot.icon === 'utensils') return <svg {...svgProps}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                      if (hotspot.icon === 'menu') return <svg {...svgProps}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 11h8"/><path d="M8 7h6"/></svg>
                      if (hotspot.icon === 'chef') return <svg {...svgProps}><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg>
                      if (hotspot.icon === 'wine') return <svg {...svgProps}><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>
                      if (hotspot.icon === 'coffee') return <svg {...svgProps}><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>
                      if (hotspot.icon === 'star') return <svg {...svgProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      if (hotspot.icon === 'heart') return <svg {...svgProps}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                      if (hotspot.icon === 'map-pin') return <svg {...svgProps}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                      if (hotspot.icon === 'phone') return <svg {...svgProps}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      if (hotspot.icon === 'clock') return <svg {...svgProps}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      if (hotspot.icon === 'image' || hotspot.type === 'image') return <svg {...svgProps}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                      return <svg {...svgProps}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    })()}
                  </div>
                  {/* Pin stem */}
                  <div className="w-0.5 h-2.5 bg-white/70 rounded-full" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                  {hotspot.title && (
                    <div className="mt-0.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm whitespace-nowrap">
                      <span className="text-[10px] font-medium text-white">{hotspot.title}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Drop overlay */}
      {isDragOverViewer && (
        <div className="absolute inset-0 z-30 bg-primary/10 border-4 border-dashed border-primary/50 flex items-center justify-center pointer-events-none">
          <div className="bg-card/90 backdrop-blur-xl rounded-xl px-6 py-4 text-center shadow-2xl">
            <p className="text-sm font-semibold text-foreground">Drop to create navigation arrow</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Loading panorama...</span>
          </div>
        </div>
      )}
    </div>
  )
}
