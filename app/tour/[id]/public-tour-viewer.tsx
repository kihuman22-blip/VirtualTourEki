'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Compass,
  Maximize,
  Minimize,
  Share2,
  Copy,
  Check,
  Code,
  Download,
  Archive,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import PanoramaViewer from '@/components/panorama/panorama-viewer'
import HotspotPopup from '@/components/panorama/hotspot-popup'
import type { Tour, Hotspot } from '@/lib/tour-types'
import { exportTourAsZip } from '@/lib/tour-export'

interface PublicTourViewerProps {
  tour: Tour
  tourName: string
}

export default function PublicTourViewer({ tour, tourName }: PublicTourViewerProps) {
  const [currentSceneId, setCurrentSceneId] = useState(
    tour.startSceneId || tour.scenes[0]?.id || ''
  )
  const [activePopup, setActivePopup] = useState<Hotspot | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showSceneStrip, setShowSceneStrip] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentScene = tour.scenes.find((s) => s.id === currentSceneId) || tour.scenes[0]
  const scenes = tour.scenes
  const currentIndex = scenes.findIndex((s) => s.id === currentSceneId)
  const prevScene = currentIndex > 0 ? scenes[currentIndex - 1] : null
  const nextScene = currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null

  useEffect(() => {
    const timer = setTimeout(() => setShowInstructions(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    if (hotspot.type === 'scene-link' && hotspot.targetSceneId) {
      setCurrentSceneId(hotspot.targetSceneId)
      setActivePopup(null)
    } else {
      setActivePopup(hotspot)
    }
  }, [])

  const handleSceneChange = useCallback((sceneId: string) => {
    setCurrentSceneId(sceneId)
    setActivePopup(null)
  }, [])

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (!currentScene) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">This tour has no scenes.</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div ref={containerRef} className="h-screen w-screen bg-background relative overflow-hidden">
        <PanoramaViewer
          scene={currentScene}
          fov={tour.settings?.defaultFov || 75}
          autoRotate={tour.settings?.autoRotate || false}
          autoRotateSpeed={tour.settings?.autoRotateSpeed || 0.5}
          onHotspotClick={handleHotspotClick}
          isEditorMode={false}
          selectedHotspotId={null}
          allScenes={tour.scenes}
        />

        {/* Top bar */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-background/70 to-transparent pointer-events-none">
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-border/50 rounded-lg px-3 py-1.5">
              <Compass className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-foreground">{tourName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 bg-card/60 backdrop-blur-md border border-border/50 text-foreground hover:bg-card/80"
                  onClick={() => setShowShare(true)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share tour</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 bg-card/60 backdrop-blur-md border border-border/50 text-foreground hover:bg-card/80"
                  onClick={handleFullscreen}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="flex items-end justify-between px-4 pb-4 bg-gradient-to-t from-background/70 via-background/30 to-transparent pt-16">
            <div className="pointer-events-auto">
              {prevScene ? (
                <button
                  onClick={() => handleSceneChange(prevScene.id)}
                  className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 hover:bg-card/80 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-foreground max-w-24 truncate">{prevScene.name}</span>
                </button>
              ) : (
                <div className="w-20" />
              )}
            </div>

            <div className="flex flex-col items-center gap-2 pointer-events-auto">
              {showSceneStrip && scenes.length > 1 && (
                <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-xl rounded-xl p-1.5 border border-border/50 max-w-[80vw] overflow-x-auto animate-in slide-in-from-bottom-2 duration-200">
                  {scenes.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => handleSceneChange(scene.id)}
                      className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                        scene.id === currentSceneId
                          ? 'border-primary scale-105 shadow-lg'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="w-20 h-12 bg-muted relative">
                        {scene.imageUrl && (
                          <img
                            src={scene.imageUrl}
                            alt={scene.name}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            loading="lazy"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                        <span className="absolute bottom-0.5 left-1 right-1 text-[9px] font-medium text-foreground truncate">
                          {scene.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                {scenes.length > 1 && (
                  <button
                    onClick={() => setShowSceneStrip(!showSceneStrip)}
                    className="bg-card/60 backdrop-blur-md border border-border/50 rounded-lg px-3 py-1.5 hover:bg-card/80 transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {showSceneStrip ? 'Hide scenes' : `${scenes.length} scenes`}
                    </span>
                  </button>
                )}
                <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-lg px-3 py-1.5 text-center">
                  <p className="text-xs font-medium text-foreground">{currentScene.name}</p>
                  {scenes.length > 1 && (
                    <p className="text-[10px] text-muted-foreground">
                      {currentIndex + 1} / {scenes.length}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pointer-events-auto">
              {nextScene ? (
                <button
                  onClick={() => handleSceneChange(nextScene.id)}
                  className="flex items-center gap-2 bg-card/60 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 hover:bg-card/80 transition-colors"
                >
                  <span className="text-xs text-foreground max-w-24 truncate">{nextScene.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ) : (
                <div className="w-20" />
              )}
            </div>
          </div>
        </div>

        {/* Powered by badge */}
        <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-card/40 backdrop-blur-sm border border-border/30 rounded-md px-2 py-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Compass className="h-2.5 w-2.5" />
            PanoraVista
          </Link>
        </div>

        {activePopup && (
          <HotspotPopup
            hotspot={activePopup}
            onClose={() => setActivePopup(null)}
            onNavigate={(sceneId) => {
              setCurrentSceneId(sceneId)
              setActivePopup(null)
            }}
          />
        )}

        <PublicShareDialog
          open={showShare}
          onClose={() => setShowShare(false)}
          tour={tour}
          tourName={tourName}
        />

        {showInstructions && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in fade-in-0 duration-500">
            <div className="bg-card/90 backdrop-blur-xl border border-border rounded-2xl px-6 py-5 text-center pointer-events-auto shadow-2xl max-w-sm mx-4 animate-in zoom-in-95 duration-300">
              <Compass className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-card-foreground mb-1">Explore the Tour</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click and drag to look around. Click on hotspots to navigate between scenes or discover more information.
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

function PublicShareDialog({
  open,
  onClose,
  tour,
  tourName,
}: {
  open: boolean
  onClose: () => void
  tour: Tour
  tourName: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [zipExporting, setZipExporting] = useState(false)
  const [zipProgress, setZipProgress] = useState<{ label: string; percent: number } | null>(null)
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleExportZip = async () => {
    setZipExporting(true)
    setZipProgress({ label: 'Preparing...', percent: 0 })
    try {
      const blob = await exportTourAsZip(tour, (progress) => {
        if (progress.phase === 'downloading') {
          const percent = Math.round((progress.current / progress.total) * 80)
          setZipProgress({ label: progress.label, percent })
        } else if (progress.phase === 'packaging') {
          setZipProgress({ label: progress.label, percent: 85 })
        } else {
          setZipProgress({ label: progress.label, percent: 100 })
        }
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tourName.toLowerCase().replace(/\s+/g, '-')}-tour.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('ZIP export failed:', err)
    } finally {
      setTimeout(() => {
        setZipExporting(false)
        setZipProgress(null)
      }, 1000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Share This Tour</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Share this virtual tour with others or embed it on your website.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Tour Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-secondary-foreground font-mono truncate">
                {shareUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={() => handleCopy(shareUrl, 'url')}
              >
                {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              <Code className="h-3 w-3 inline mr-1" />
              Embed Code
            </label>
            <div className="flex items-start gap-2">
              <div className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono break-all max-h-20 overflow-y-auto">
                {embedCode}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0 mt-0.5"
                onClick={() => handleCopy(embedCode, 'embed')}
              >
                {copied === 'embed' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Download
            </label>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleExportZip}
              disabled={zipExporting}
            >
              {zipExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {zipExporting ? 'Exporting...' : 'Download Tour as ZIP (self-hosted)'}
            </Button>
            {zipProgress && (
              <div className="space-y-1.5 mt-2">
                <Progress value={zipProgress.percent} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">{zipProgress.label}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
