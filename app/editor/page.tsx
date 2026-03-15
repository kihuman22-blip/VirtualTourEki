"use client"

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Layers,
  Navigation,
  Settings,
  MousePointerClick,
  Upload,
  Compass,
  ArrowUpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import PanoramaViewer from '@/components/panorama/panorama-viewer'
import HotspotPopup from '@/components/panorama/hotspot-popup'
import ViewerControls from '@/components/panorama/viewer-controls'
import ScenePanel from '@/components/editor/scene-panel'
import HotspotPanel from '@/components/editor/hotspot-panel'
import SettingsPanel from '@/components/editor/settings-panel'
import EditorToolbar from '@/components/editor/editor-toolbar'
import type { Tour, Hotspot, HotspotPosition } from '@/lib/tour-types'
import { uploadTourImage, isBlobUrl, persistBlobUrl } from '@/lib/upload-image'
import {
  useTour,
  useCurrentScene,
  useCurrentSceneId,
  useEditorMode,
  useAddHotspotType,
  useSelectedHotspotId,
  initTour,
  loadTour,
  addScene,
  setCurrentScene,
  addHotspotToScene,
  updateHotspot,
  removeHotspot,
  selectHotspot,
  setEditorMode,
  setAddHotspotType,
} from '@/lib/tour-store'

export default function EditorPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <EditorPage />
    </Suspense>
  )
}

function EditorPage() {
  const tour = useTour()
  const currentScene = useCurrentScene()
  const currentSceneId = useCurrentSceneId()
  const editorMode = useEditorMode()
  const addHotspotType = useAddHotspotType()
  const selectedHotspotId = useSelectedHotspotId()
  const [activePopup, setActivePopup] = useState<Hotspot | null>(null)
  const [sidebarTab, setSidebarTab] = useState('scenes')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewportDragOver, setViewportDragOver] = useState(false)
  const viewportFileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const tourDbId = searchParams.get('id')
  const [dbLoaded, setDbLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const supabase = createClient()

  // Scene picker state: after placing an arrow, show a picker to choose target
  const [scenePicker, setScenePicker] = useState<{
    open: boolean
    hotspotId: string | null
  }>({ open: false, hotspotId: null })

  // Load tour from Supabase if ?id= is present
  useEffect(() => {
    if (tourDbId && !dbLoaded && supabase) {
      const loadFromDb = async () => {
        const { data } = await supabase
          .from('tours')
          .select('*')
          .eq('id', tourDbId)
          .single()
        if (data?.tour_data) {
          loadTour(data.tour_data as unknown as Tour)
        }
        setDbLoaded(true)
      }
      loadFromDb()
    } else if (!tourDbId && !dbLoaded) {
      // No ?id= param means "create new tour" -- always reset to a blank tour
      const blankTour = initTour('My Virtual Tour', 'An immersive 360 experience')
      loadTour(blankTour)
      setDbLoaded(true)
    } else if (!dbLoaded) {
      setDbLoaded(true)
    }
  }, [tourDbId, dbLoaded, supabase, tour])

  // Auto-save to Supabase (debounced) -- persists any remaining blob URLs first
  const saveTour = useCallback(
    async (tourData: Tour) => {
      if (!supabase) return
      setSaving(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Persist any blob URLs to Supabase Storage before saving
        const persistedScenes = await Promise.all(
          tourData.scenes.map(async (scene) => {
            let imageUrl = scene.imageUrl
            if (isBlobUrl(imageUrl)) {
              imageUrl = await persistBlobUrl(imageUrl, 'scenes')
            }
            const persistedHotspots = await Promise.all(
              scene.hotspots.map(async (h) => {
                const updates: Partial<typeof h> = {}
                if (h.imageUrl && isBlobUrl(h.imageUrl)) {
                  updates.imageUrl = await persistBlobUrl(h.imageUrl, 'hotspots')
                }
                if (h.pdfUrl && isBlobUrl(h.pdfUrl)) {
                  updates.pdfUrl = await persistBlobUrl(h.pdfUrl, 'files')
                }
                // Persist images array (multiple images for carousel)
                if (h.images && h.images.length > 0) {
                  const persistedImages = await Promise.all(
                    h.images.map(async (imgUrl) => {
                      if (isBlobUrl(imgUrl)) {
                        return await persistBlobUrl(imgUrl, 'hotspots')
                      }
                      return imgUrl
                    })
                  )
                  updates.images = persistedImages
                }
                return Object.keys(updates).length > 0 ? { ...h, ...updates } : h
              })
            )
            return { ...scene, imageUrl, hotspots: persistedHotspots }
          })
        )
        const persistedTour = { ...tourData, scenes: persistedScenes }

        // Update local store with persisted URLs so the viewer never sees blob URLs
        loadTour(persistedTour)

        const payload = {
          user_id: user.id,
          name: persistedTour.name,
          description: persistedTour.description || null,
          tour_data: persistedTour as unknown as Record<string, unknown>,
          is_public: persistedTour.settings?.showSceneList ?? false,
          scene_count: persistedTour.scenes.length,
        }

        if (tourDbId) {
          await supabase.from('tours').update(payload).eq('id', tourDbId)
        } else {
          const { data } = await supabase.from('tours').insert(payload).select('id').single()
          if (data?.id) {
            window.history.replaceState(null, '', `/editor?id=${data.id}`)
          }
        }
        setLastSaved(new Date().toLocaleTimeString())
      } finally {
        setSaving(false)
      }
    },
    [tourDbId, supabase]
  )

  // Auto-save when tour changes (debounced 2 seconds)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    // Don't auto-save if not loaded from DB yet or if tour is empty
    if (!dbLoaded || !tour || tour.scenes.length === 0) return
    
    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    // Schedule auto-save after 2 seconds of no changes
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveTour(tour)
    }, 2000)
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [tour, dbLoaded, saveTour])

  const handleHotspotClick = useCallback(
    (hotspot: Hotspot) => {
      // Scene-link arrows navigate to the target scene
      if (hotspot.type === 'scene-link' && hotspot.targetSceneId) {
        setCurrentScene(hotspot.targetSceneId)
        setActivePopup(null)
        return
      }
      // Image / info hotspots: show popup AND select for editing in sidebar
      selectHotspot(hotspot.id)
      setSidebarTab('hotspots')
      setActivePopup(hotspot)
    },
    []
  )

  const handleSceneClick = useCallback(
    (position: HotspotPosition) => {
      if (editorMode === 'add-hotspot' && currentSceneId) {
        const title =
          addHotspotType === 'scene-link'
            ? 'Go to scene'
            : addHotspotType === 'info'
              ? 'Information'
              : addHotspotType === 'image'
                ? 'Image'
                : 'Content'
        const hotspot = addHotspotToScene(currentSceneId, addHotspotType, position, title)

        // If scene-link: show scene picker dialog immediately
        if (addHotspotType === 'scene-link') {
          setScenePicker({ open: true, hotspotId: hotspot.id })
        } else {
          setSidebarTab('hotspots')
        }
      }
    },
    [editorMode, currentSceneId, addHotspotType]
  )

  // When a target scene is picked from the dialog
  const handlePickTargetScene = useCallback(
    (targetSceneId: string) => {
      if (!currentSceneId || !scenePicker.hotspotId) return
      const targetScene = tour?.scenes.find((s) => s.id === targetSceneId)
      updateHotspot(currentSceneId, scenePicker.hotspotId, {
        targetSceneId,
        title: targetScene ? `Go to ${targetScene.name}` : 'Go to scene',
        icon: 'arrow' as const,
        color: '#4db8a4',
      })
      setScenePicker({ open: false, hotspotId: null })
      setEditorMode('view')
      setSidebarTab('hotspots')
    },
    [currentSceneId, scenePicker.hotspotId, tour?.scenes]
  )

  // Hotspot reposition via drag
  const handleHotspotMoved = useCallback(
    (hotspotId: string, newPosition: HotspotPosition) => {
      if (!currentSceneId) return
      updateHotspot(currentSceneId, hotspotId, { position: newPosition })
    },
    [currentSceneId]
  )

  const handleDropScene = useCallback(
    (droppedSceneId: string, position: HotspotPosition) => {
      if (!currentSceneId || droppedSceneId === currentSceneId) return
      const targetScene = tour?.scenes.find((s) => s.id === droppedSceneId)
      const title = targetScene ? `Go to ${targetScene.name}` : 'Go to scene'
      const hotspot = addHotspotToScene(currentSceneId, 'scene-link', position, title)
      updateHotspot(currentSceneId, hotspot.id, {
        targetSceneId: droppedSceneId,
        icon: 'arrow' as const,
        color: '#4db8a4',
      })
      setEditorMode('view')
      setSidebarTab('hotspots')
    },
    [currentSceneId, tour?.scenes]
  )

  const handleSceneChange = useCallback((sceneId: string) => {
    setCurrentScene(sceneId)
    setActivePopup(null)
  }, [])

  // Activate "Place Arrow" mode
  const handlePlaceArrow = useCallback(() => {
    setAddHotspotType('scene-link')
    setEditorMode('add-hotspot')
  }, [])

  // Available target scenes (all except current)
  const targetScenes = tour?.scenes.filter((s) => s.id !== currentSceneId) || []

  if (!tour) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <EditorToolbar saving={saving} lastSaved={lastSaved} onSaveNow={() => saveTour(tour)} />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar toggle button (mobile) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-14 left-2 z-30 md:hidden h-9 w-9 rounded-lg bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        {/* Left Sidebar */}
        <div className={`${sidebarOpen ? 'w-64 md:w-72' : 'w-0'} border-r border-border bg-card flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200`}>
          <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex flex-col h-full min-w-[16rem] md:min-w-[18rem]">
            <TabsList className="grid grid-cols-3 m-2 h-9">
              <TabsTrigger value="scenes" className="text-xs gap-1">
                <Layers className="h-3.5 w-3.5" />
                Scenes
              </TabsTrigger>
              <TabsTrigger value="hotspots" className="text-xs gap-1">
                <Navigation className="h-3.5 w-3.5" />
                Hotspots
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs gap-1">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="scenes" className="flex-1 overflow-hidden m-0">
              <ScenePanel />
            </TabsContent>
            <TabsContent value="hotspots" className="flex-1 overflow-hidden m-0">
              <HotspotPanel />
            </TabsContent>
            <TabsContent value="settings" className="flex-1 overflow-hidden m-0">
              <SettingsPanel />
            </TabsContent>
          </Tabs>
        </div>

        {/* Main viewport */}
        <div className="flex-1 relative bg-background">
          {currentScene ? (
            <>
              <PanoramaViewer
                scene={currentScene}
                fov={tour.settings.defaultFov}
                autoRotate={tour.settings.autoRotate}
                autoRotateSpeed={tour.settings.autoRotateSpeed}
                iconSize={tour.settings.iconSize ?? 40}
                onHotspotClick={handleHotspotClick}
                onHotspotMoved={handleHotspotMoved}
                onSceneClick={handleSceneClick}
                onDropScene={handleDropScene}
                isEditorMode={editorMode === 'add-hotspot'}
                selectedHotspotId={selectedHotspotId}
                allScenes={tour.scenes}
              />
              <ViewerControls
                scenes={tour.scenes}
                currentSceneId={currentScene.id}
                onSceneChange={handleSceneChange}
                showSceneList={tour.settings.showSceneList}
              />
              {activePopup && (
                <HotspotPopup
                  hotspot={activePopup}
                  onClose={() => setActivePopup(null)}
                  onNavigate={(sceneId) => {
                    setCurrentScene(sceneId)
                    setActivePopup(null)
                  }}
                />
              )}

              {/* Floating bottom toolbar - add hotspot buttons */}
              {editorMode === 'view' && currentScene && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-card/90 backdrop-blur-xl border border-border rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 shadow-2xl">
                    {targetScenes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                        onClick={() => { setAddHotspotType('scene-link'); setEditorMode('add-hotspot') }}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        Arrow
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                      onClick={() => { setAddHotspotType('info'); setEditorMode('add-hotspot') }}
                    >
                      <MousePointerClick className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Info
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                      onClick={() => { setAddHotspotType('image'); setEditorMode('add-hotspot') }}
                    >
                      <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Image
                    </Button>
                  </div>
                </div>
              )}

              {/* Editor mode indicator */}
              {editorMode === 'add-hotspot' && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                  <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm">
                    {addHotspotType === 'scene-link' ? 'Click to place a navigation arrow' : `Click to place a ${addHotspotType} hotspot`}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full h-8 text-xs"
                    onClick={() => setEditorMode('view')}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div
              className={`flex items-center justify-center h-full transition-colors ${viewportDragOver ? 'bg-primary/5' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setViewportDragOver(true)
              }}
              onDragLeave={() => setViewportDragOver(false)}
              onDrop={async (e) => {
                e.preventDefault()
                setViewportDragOver(false)
                const files = Array.from(e.dataTransfer.files).filter((f) =>
                  f.type.startsWith('image/')
                )
                for (const file of files) {
                  const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
                  try {
                    const url = await uploadTourImage(file, 'scenes')
                    addScene(name, url)
                  } catch {
                    const url = URL.createObjectURL(file)
                    addScene(name, url)
                  }
                }
              }}
            >
              <input
                ref={viewportFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files
                  if (!files) return
                  for (const file of Array.from(files)) {
                    if (!file.type.startsWith('image/')) continue
                    const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
                    try {
                      const url = await uploadTourImage(file, 'scenes')
                      addScene(name, url)
                    } catch {
                      const url = URL.createObjectURL(file)
                      addScene(name, url)
                    }
                  }
                }}
              />
              {viewportDragOver ? (
                <div className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-2xl border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-primary mb-1">Drop your images here</h3>
                  <p className="text-sm text-muted-foreground">
                    They will be added as panorama scenes
                  </p>
                </div>
              ) : (
                <div className="text-center max-w-md">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                    <Compass className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 text-balance">
                    Start building your virtual tour
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed text-pretty">
                    Upload your 360-degree panorama images to create an immersive experience. You can
                    add multiple scenes and connect them with interactive hotspots.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={() => viewportFileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload Panorama Images
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-4">
                    or drag and drop images anywhere on this area
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scene Picker Dialog - appears after placing an arrow */}
      <Dialog
        open={scenePicker.open}
        onOpenChange={(open) => {
          if (!open) {
            // If closed without picking, remove the hotspot we just placed
            if (scenePicker.hotspotId && currentSceneId) {
              removeHotspot(currentSceneId, scenePicker.hotspotId)
            }
            setScenePicker({ open: false, hotspotId: null })
            setEditorMode('view')
          }
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Select Target Scene</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Which scene should this arrow navigate to?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-80 overflow-y-auto py-1">
            {targetScenes.map((s) => (
              <button
                key={s.id}
                onClick={() => handlePickTargetScene(s.id)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
              >
                <div className="w-16 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {s.imageUrl && (
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {s.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.hotspots.length} hotspot{s.hotspots.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <ArrowUpCircle className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
            {targetScenes.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No other scenes available.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Add more scenes first to create navigation arrows.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
