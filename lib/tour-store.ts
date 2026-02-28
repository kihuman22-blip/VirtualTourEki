"use client"

import { useSyncExternalStore, useCallback } from 'react'
import type { Tour, Scene, Hotspot, HotspotPosition, TourSettings } from './tour-types'
import { createTour, createScene, createHotspot, generateId } from './tour-types'

type Listener = () => void

interface TourStore {
  tour: Tour | null
  currentSceneId: string | null
  selectedHotspotId: string | null
  editorMode: 'view' | 'edit-hotspot' | 'add-hotspot'
  addHotspotType: Hotspot['type']
  isTransitioning: boolean
  viewerYaw: number
  viewerPitch: number
}

let state: TourStore = {
  tour: null,
  currentSceneId: null,
  selectedHotspotId: null,
  editorMode: 'view',
  addHotspotType: 'scene-link',
  isTransitioning: false,
  viewerYaw: 0,
  viewerPitch: 0,
}

const listeners = new Set<Listener>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function setState(partial: Partial<TourStore>) {
  state = { ...state, ...partial }
  emitChange()
}

function getState(): TourStore {
  return state
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Actions
export function initTour(name: string, description: string): Tour {
  const tour = createTour(name, description)
  setState({ tour, currentSceneId: null, selectedHotspotId: null })
  return tour
}

export function loadTour(tour: Tour) {
  setState({
    tour,
    currentSceneId: tour.startSceneId || (tour.scenes[0]?.id ?? null),
    selectedHotspotId: null,
    editorMode: 'view',
  })
}

export function addScene(name: string, imageUrl: string): Scene {
  const scene = createScene(name, imageUrl)
  const tour = state.tour
  if (!tour) throw new Error('No tour loaded')

  const updatedTour: Tour = {
    ...tour,
    scenes: [...tour.scenes, scene],
    startSceneId: tour.startSceneId || scene.id,
    updatedAt: new Date().toISOString(),
  }

  setState({
    tour: updatedTour,
    currentSceneId: state.currentSceneId || scene.id,
  })
  return scene
}

export function removeScene(sceneId: string) {
  const tour = state.tour
  if (!tour) return

  const scenes = tour.scenes.filter((s) => s.id !== sceneId)
  // Remove hotspots linking to this scene
  const updatedScenes = scenes.map((s) => ({
    ...s,
    hotspots: s.hotspots.filter((h) => h.targetSceneId !== sceneId),
  }))

  const updatedTour: Tour = {
    ...tour,
    scenes: updatedScenes,
    startSceneId: tour.startSceneId === sceneId ? (updatedScenes[0]?.id ?? '') : tour.startSceneId,
    updatedAt: new Date().toISOString(),
  }

  setState({
    tour: updatedTour,
    currentSceneId:
      state.currentSceneId === sceneId ? (updatedScenes[0]?.id ?? null) : state.currentSceneId,
    selectedHotspotId: null,
  })
}

export function updateScene(sceneId: string, updates: Partial<Scene>) {
  const tour = state.tour
  if (!tour) return

  const updatedTour: Tour = {
    ...tour,
    scenes: tour.scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)),
    updatedAt: new Date().toISOString(),
  }
  setState({ tour: updatedTour })
}

export function setCurrentScene(sceneId: string) {
  setState({ currentSceneId: sceneId, selectedHotspotId: null })
}

export function addHotspotToScene(
  sceneId: string,
  type: Hotspot['type'],
  position: HotspotPosition,
  title: string
): Hotspot {
  const tour = state.tour
  if (!tour) throw new Error('No tour loaded')

  const hotspot = createHotspot(type, position, title)
  const updatedTour: Tour = {
    ...tour,
    scenes: tour.scenes.map((s) =>
      s.id === sceneId ? { ...s, hotspots: [...s.hotspots, hotspot] } : s
    ),
    updatedAt: new Date().toISOString(),
  }

  setState({ tour: updatedTour, selectedHotspotId: hotspot.id, editorMode: 'edit-hotspot' })
  return hotspot
}

export function updateHotspot(sceneId: string, hotspotId: string, updates: Partial<Hotspot>) {
  const tour = state.tour
  if (!tour) return

  const updatedTour: Tour = {
    ...tour,
    scenes: tour.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            hotspots: s.hotspots.map((h) => (h.id === hotspotId ? { ...h, ...updates } : h)),
          }
        : s
    ),
    updatedAt: new Date().toISOString(),
  }
  setState({ tour: updatedTour })
}

export function removeHotspot(sceneId: string, hotspotId: string) {
  const tour = state.tour
  if (!tour) return

  const updatedTour: Tour = {
    ...tour,
    scenes: tour.scenes.map((s) =>
      s.id === sceneId
        ? { ...s, hotspots: s.hotspots.filter((h) => h.id !== hotspotId) }
        : s
    ),
    updatedAt: new Date().toISOString(),
  }
  setState({ tour: updatedTour, selectedHotspotId: null })
}

export function setEditorMode(mode: TourStore['editorMode']) {
  setState({ editorMode: mode, selectedHotspotId: mode === 'view' ? null : state.selectedHotspotId })
}

export function setAddHotspotType(type: Hotspot['type']) {
  setState({ addHotspotType: type })
}

export function selectHotspot(hotspotId: string | null) {
  setState({ selectedHotspotId: hotspotId, editorMode: hotspotId ? 'edit-hotspot' : 'view' })
}

export function setTransitioning(val: boolean) {
  setState({ isTransitioning: val })
}

export function updateTourSettings(settings: Partial<TourSettings>) {
  const tour = state.tour
  if (!tour) return
  setState({
    tour: {
      ...tour,
      settings: { ...tour.settings, ...settings },
      updatedAt: new Date().toISOString(),
    },
  })
}

export function updateTourInfo(info: { name?: string; description?: string }) {
  const tour = state.tour
  if (!tour) return
  setState({
    tour: { ...tour, ...info, updatedAt: new Date().toISOString() },
  })
}

export function setStartScene(sceneId: string) {
  const tour = state.tour
  if (!tour) return
  setState({
    tour: { ...tour, startSceneId: sceneId, updatedAt: new Date().toISOString() },
  })
}

export function setViewerAngles(yaw: number, pitch: number) {
  state = { ...state, viewerYaw: yaw, viewerPitch: pitch }
  // Don't emit for performance - viewer reads directly
}

export function exportTour(): string {
  if (!state.tour) return ''
  return JSON.stringify(state.tour, null, 2)
}

export function importTour(json: string): boolean {
  try {
    const tour = JSON.parse(json) as Tour
    if (!tour.id || !tour.scenes) return false
    loadTour(tour)
    return true
  } catch {
    return false
  }
}

// Create demo tour with sample scenes
export function createDemoTour(): Tour {
  const tour = createTour('My Virtual Tour', 'An immersive 360 experience')

  const scene1 = createScene('Grand Lobby', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=4096&h=2048&fit=crop')
  const scene2 = createScene('Modern Office', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=4096&h=2048&fit=crop')
  const scene3 = createScene('Art Gallery', 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=4096&h=2048&fit=crop')

  // Add hotspot linking scene1 -> scene2
  const hs1: Hotspot = {
    id: generateId(),
    type: 'scene-link',
    position: { yaw: 45, pitch: -5 },
    title: 'Go to Office',
    targetSceneId: scene2.id,
    icon: 'arrow',
    color: '#4db8a4',
  }

  // Add info hotspot to scene1
  const hs2: Hotspot = {
    id: generateId(),
    type: 'info',
    position: { yaw: -30, pitch: 10 },
    title: 'Welcome',
    description: 'Welcome to our virtual tour! Click on hotspots to navigate between scenes and discover more information.',
    icon: 'info',
    color: '#10b981',
  }

  // Scene2 -> Scene3
  const hs3: Hotspot = {
    id: generateId(),
    type: 'scene-link',
    position: { yaw: 90, pitch: 0 },
    title: 'Visit Gallery',
    targetSceneId: scene3.id,
    icon: 'arrow',
    color: '#4db8a4',
  }

  // Scene2 -> Scene1
  const hs4: Hotspot = {
    id: generateId(),
    type: 'scene-link',
    position: { yaw: -90, pitch: -5 },
    title: 'Back to Lobby',
    targetSceneId: scene1.id,
    icon: 'arrow',
    color: '#4db8a4',
  }

  // Scene3 -> Scene1
  const hs5: Hotspot = {
    id: generateId(),
    type: 'scene-link',
    position: { yaw: 180, pitch: -5 },
    title: 'Return to Lobby',
    targetSceneId: scene1.id,
    icon: 'arrow',
    color: '#4db8a4',
  }

  // Info hotspot on scene3
  const hs6: Hotspot = {
    id: generateId(),
    type: 'info',
    position: { yaw: -45, pitch: 15 },
    title: 'Featured Artwork',
    description: 'This gallery features contemporary digital art pieces from around the world. Each piece represents a unique perspective on modern society.',
    icon: 'info',
    color: '#f59e0b',
  }

  scene1.hotspots = [hs1, hs2]
  scene2.hotspots = [hs3, hs4]
  scene3.hotspots = [hs5, hs6]

  tour.scenes = [scene1, scene2, scene3]
  tour.startSceneId = scene1.id

  return tour
}

// Hooks
export function useTourStore<T>(selector: (state: TourStore) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState())
  )
}

export function useTour() {
  return useTourStore((s) => s.tour)
}

export function useCurrentScene(): Scene | null {
  return useTourStore((s) => {
    if (!s.tour || !s.currentSceneId) return null
    return s.tour.scenes.find((scene) => scene.id === s.currentSceneId) ?? null
  })
}

export function useCurrentSceneId() {
  return useTourStore((s) => s.currentSceneId)
}

export function useSelectedHotspot(): Hotspot | null {
  return useTourStore((s) => {
    if (!s.tour || !s.currentSceneId || !s.selectedHotspotId) return null
    const scene = s.tour.scenes.find((sc) => sc.id === s.currentSceneId)
    return scene?.hotspots.find((h) => h.id === s.selectedHotspotId) ?? null
  })
}

export function useEditorMode() {
  return useTourStore((s) => s.editorMode)
}

export function useAddHotspotType() {
  return useTourStore((s) => s.addHotspotType)
}

export function useIsTransitioning() {
  return useTourStore((s) => s.isTransitioning)
}

export function useSelectedHotspotId() {
  return useTourStore((s) => s.selectedHotspotId)
}
