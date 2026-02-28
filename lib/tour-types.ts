export interface HotspotPosition {
  yaw: number
  pitch: number
}

export interface Hotspot {
  id: string
  type: 'scene-link' | 'info' | 'image' | 'content'
  position: HotspotPosition
  title: string
  targetSceneId?: string
  description?: string
  imageUrl?: string
  content?: string
  icon?: 'arrow' | 'info' | 'image' | 'link' | 'eye' | 'utensils' | 'menu' | 'chef' | 'wine' | 'coffee' | 'star' | 'heart' | 'map-pin' | 'phone' | 'clock'
  color?: string
}

export interface Scene {
  id: string
  name: string
  imageUrl: string
  thumbnailUrl?: string
  hotspots: Hotspot[]
  initialViewDirection: HotspotPosition
}

export interface Tour {
  id: string
  name: string
  description: string
  scenes: Scene[]
  startSceneId: string
  createdAt: string
  updatedAt: string
  settings: TourSettings
}

export interface TourSettings {
  autoRotate: boolean
  autoRotateSpeed: number
  showMinimap: boolean
  showSceneList: boolean
  transitionDuration: number
  defaultFov: number
  controlType: 'orbit' | 'drag'
  showCompass: boolean
  backgroundColor: string
}

export const DEFAULT_TOUR_SETTINGS: TourSettings = {
  autoRotate: false,
  autoRotateSpeed: 0.5,
  showMinimap: true,
  showSceneList: true,
  transitionDuration: 800,
  defaultFov: 75,
  controlType: 'drag',
  showCompass: true,
  backgroundColor: '#0a0a0a',
}

export function createScene(
  name: string,
  imageUrl: string,
  id?: string
): Scene {
  return {
    id: id || generateId(),
    name,
    imageUrl,
    hotspots: [],
    initialViewDirection: { yaw: 0, pitch: 0 },
  }
}

export function createHotspot(
  type: Hotspot['type'],
  position: HotspotPosition,
  title: string,
  id?: string
): Hotspot {
  return {
    id: id || generateId(),
    type,
    position,
    title,
    icon: type === 'scene-link' ? 'arrow' : type === 'info' ? 'info' : type === 'image' ? 'image' : 'link',
    // Navigation arrows use teal, info/image hotspots use orange/amber
    color: type === 'scene-link' ? '#4db8a4' : '#f59e0b',
  }
}

export function createTour(name: string, description: string): Tour {
  const id = generateId()
  return {
    id,
    name,
    description,
    scenes: [],
    startSceneId: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: { ...DEFAULT_TOUR_SETTINGS },
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function yawPitchToVector3(
  yaw: number,
  pitch: number,
  radius: number = 500
): { x: number; y: number; z: number } {
  const yawRad = (yaw * Math.PI) / 180
  const pitchRad = (pitch * Math.PI) / 180
  return {
    x: radius * Math.cos(pitchRad) * Math.sin(yawRad),
    y: radius * Math.sin(pitchRad),
    z: radius * Math.cos(pitchRad) * Math.cos(yawRad),
  }
}

export function vector3ToYawPitch(
  x: number,
  y: number,
  z: number
): HotspotPosition {
  const radius = Math.sqrt(x * x + y * y + z * z)
  const pitch = (Math.asin(y / radius) * 180) / Math.PI
  const yaw = (Math.atan2(x, z) * 180) / Math.PI
  return { yaw, pitch }
}

// Sample panorama images for demo
export const SAMPLE_PANORAMAS = [
  {
    name: 'Grand Lobby',
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=4096&h=2048&fit=crop',
  },
  {
    name: 'Modern Office',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=4096&h=2048&fit=crop',
  },
  {
    name: 'Art Gallery',
    url: 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=4096&h=2048&fit=crop',
  },
  {
    name: 'Rooftop Terrace',
    url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=4096&h=2048&fit=crop',
  },
  {
    name: 'Conference Room',
    url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=4096&h=2048&fit=crop',
  },
]
