"use client"

import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  RotateCcw,
  List,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Scene } from '@/lib/tour-types'

interface ViewerControlsProps {
  scenes: Scene[]
  currentSceneId: string
  onSceneChange: (sceneId: string) => void
  onFullscreen?: () => void
  isFullscreen?: boolean
  showSceneList?: boolean
  onToggleSceneList?: () => void
}

export default function ViewerControls({
  scenes,
  currentSceneId,
  onSceneChange,
  onFullscreen,
  isFullscreen,
  showSceneList,
  onToggleSceneList,
}: ViewerControlsProps) {
  const currentIndex = scenes.findIndex((s) => s.id === currentSceneId)
  const prevScene = currentIndex > 0 ? scenes[currentIndex - 1] : null
  const nextScene = currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null

  return (
    <TooltipProvider>
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* Scene info bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-t from-background/90 via-background/60 to-transparent">
          {/* Scene navigation */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 bg-secondary/80 backdrop-blur-sm hover:bg-secondary"
                  disabled={!prevScene}
                  onClick={() => prevScene && onSceneChange(prevScene.id)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous scene</TooltipContent>
            </Tooltip>

            <div className="bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <p className="text-sm font-medium text-secondary-foreground">
                {scenes.find((s) => s.id === currentSceneId)?.name || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} of {scenes.length}
              </p>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 bg-secondary/80 backdrop-blur-sm hover:bg-secondary"
                  disabled={!nextScene}
                  onClick={() => nextScene && onSceneChange(nextScene.id)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next scene</TooltipContent>
            </Tooltip>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {onToggleSceneList && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9 bg-secondary/80 backdrop-blur-sm hover:bg-secondary"
                    onClick={onToggleSceneList}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle scene list</TooltipContent>
              </Tooltip>
            )}
            {onFullscreen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9 bg-secondary/80 backdrop-blur-sm hover:bg-secondary"
                    onClick={onFullscreen}
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Scene thumbnails strip */}
      {showSceneList && scenes.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-secondary/80 backdrop-blur-xl rounded-xl p-2 border border-border/50 max-w-[90%] overflow-x-auto">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => onSceneChange(scene.id)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                scene.id === currentSceneId
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent hover:border-muted-foreground/30'
              }`}
            >
              <div className="w-20 h-12 bg-muted relative">
                <img
                  src={scene.imageUrl}
                  alt={scene.name}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                <span className="absolute bottom-0.5 left-1 text-[9px] font-medium text-foreground truncate max-w-[72px]">
                  {scene.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </TooltipProvider>
  )
}
