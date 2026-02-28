"use client"

import { useState, useRef, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Star,
  Upload,
  MoreHorizontal,
  Pencil,
  X,
  FolderOpen,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SAMPLE_PANORAMAS } from '@/lib/tour-types'
import { uploadTourImage } from '@/lib/upload-image'
import {
  useTour,
  useCurrentSceneId,
  setCurrentScene,
  addScene,
  removeScene,
  updateScene,
  setStartScene,
} from '@/lib/tour-store'

export default function ScenePanel() {
  const tour = useTour()
  const currentSceneId = useCurrentSceneId()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneName, setSceneName] = useState('')
  const [sceneUrl, setSceneUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadTab, setUploadTab] = useState<'upload' | 'url' | 'samples'>('upload')
  const [isUploading, setIsUploading] = useState(false)
  const dropFileInputRef = useRef<HTMLInputElement>(null)

  if (!tour) return null

  const resetDialog = () => {
    setSceneName('')
    setSceneUrl('')
    setPreviewUrl('')
    setUploadTab('upload')
  }

  const openAddDialog = () => {
    resetDialog()
    setShowAddDialog(true)
  }

  const handleAddScene = () => {
    if (sceneName && sceneUrl) {
      addScene(sceneName, sceneUrl)
      resetDialog()
      setShowAddDialog(false)
    }
  }

  const handleAddSample = (sample: { name: string; url: string }) => {
    addScene(sample.name, sample.url)
    resetDialog()
    setShowAddDialog(false)
  }

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    // Show local preview immediately
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    if (!sceneName) {
      setSceneName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    }
    // Upload to Supabase Storage for a permanent URL
    setIsUploading(true)
    try {
      const permanentUrl = await uploadTourImage(file, 'scenes')
      setSceneUrl(permanentUrl)
    } catch {
      setSceneUrl(localPreview)
    } finally {
      setIsUploading(false)
    }
  }

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (files.length === 1) {
      processFile(files[0])
      return
    }
    setIsUploading(true)
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
    setIsUploading(false)
    resetDialog()
    setShowAddDialog(false)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (files.length === 0) return
      if (files.length === 1 && showAddDialog) {
        processFile(files[0])
        return
      }
      setIsUploading(true)
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
      setIsUploading(false)
      if (showAddDialog) {
        resetDialog()
        setShowAddDialog(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAddDialog, sceneName]
  )

  return (
    <div
      className="flex flex-col h-full relative"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Scenes</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={openAddDialog}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {dragOver && (
        <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-primary">Drop images here</p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tour.scenes.length === 0 && (
            <div className="text-center py-6 px-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ImageIcon className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No scenes yet</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Upload 360 panorama images to start building.
              </p>
              <div className="flex flex-col gap-2">
                <Button size="sm" className="w-full text-xs gap-1.5" onClick={openAddDialog}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload Images
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={() => { setUploadTab('samples'); setShowAddDialog(true) }}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Use Sample Panoramas
                </Button>
              </div>
            </div>
          )}

          {tour.scenes.length >= 2 && (
            <div className="mx-1 mb-1 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/10">
              <p className="text-[10px] text-primary/80 leading-relaxed">
                Use the "Place Navigation Arrow" button on the panorama to link scenes together.
              </p>
            </div>
          )}

          {tour.scenes.map((scene) => (
            <div
              key={scene.id}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-scene-id', scene.id)
                e.dataTransfer.setData('text/plain', scene.name)
                e.dataTransfer.effectAllowed = 'link'
              }}
              onClick={() => setCurrentScene(scene.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setCurrentScene(scene.id)
                }
              }}
              className={`w-full group flex items-start gap-2 rounded-lg p-2 text-left transition-colors cursor-pointer ${
                scene.id === currentSceneId
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-secondary border border-transparent'
              }`}
            >
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 flex-shrink-0 cursor-grab" />
              <div className="w-14 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
              </div>
              <div className="flex-1 min-w-0">
                {editingSceneId === scene.id ? (
                  <Input
                    value={scene.name}
                    onChange={(e) => updateScene(scene.id, { name: e.target.value })}
                    onBlur={() => setEditingSceneId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingSceneId(null)}
                    className="h-6 text-xs px-1"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground truncate">{scene.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {scene.hotspots.length} hotspot{scene.hotspots.length !== 1 ? 's' : ''}
                  {scene.id === tour.startSceneId && (
                    <span className="ml-1.5 text-primary"><Star className="h-2.5 w-2.5 inline" /> Start</span>
                  )}
                </p>
              </div>
              {/* Use a separate div to stop propagation and avoid nesting buttons */}
              <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setEditingSceneId(scene.id)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStartScene(scene.id)}>
                      <Star className="h-3.5 w-3.5 mr-2" />
                      Set as start
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => removeScene(scene.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Add Scene Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetDialog() }}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Add Scene</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload a 360-degree panorama image or pick a sample.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
            {([
              { key: 'upload' as const, label: 'Upload' },
              { key: 'url' as const, label: 'From URL' },
              { key: 'samples' as const, label: 'Samples' },
            ]).map((tab) => (
              <div
                key={tab.key}
                role="tab"
                tabIndex={0}
                aria-selected={uploadTab === tab.key}
                onClick={() => setUploadTab(tab.key)}
                onKeyDown={(e) => { if (e.key === 'Enter') setUploadTab(tab.key) }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors text-center cursor-pointer ${
                  uploadTab === tab.key ? 'bg-card text-card-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>

          {uploadTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => dropFileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file) processFile(file) }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                {previewUrl ? (
                  <div className="space-y-3">
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-muted-foreground">Click to choose a different image</p>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">Equirectangular 360 images work best</p>
                  </>
                )}
              </div>
              <input ref={dropFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMultiFileUpload} />
              {previewUrl && (
                <div>
                  <Label className="text-card-foreground">Scene Name</Label>
                  <Input value={sceneName} onChange={(e) => setSceneName(e.target.value)} placeholder="e.g., Living Room" className="mt-1.5" autoFocus />
                </div>
              )}
              {previewUrl && (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setPreviewUrl(''); setSceneUrl(''); setSceneName('') }}>Clear</Button>
                  <Button onClick={handleAddScene} disabled={!sceneName || !sceneUrl || isUploading}>
                    {isUploading ? 'Uploading...' : 'Add Scene'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {uploadTab === 'url' && (
            <div className="space-y-4">
              <div>
                <Label className="text-card-foreground">Scene Name</Label>
                <Input value={sceneName} onChange={(e) => setSceneName(e.target.value)} placeholder="e.g., Living Room" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-card-foreground">Image URL</Label>
                <Input value={sceneUrl} onChange={(e) => { setSceneUrl(e.target.value); setPreviewUrl(e.target.value) }} placeholder="https://example.com/panorama.jpg" className="mt-1.5" />
              </div>
              {previewUrl && sceneUrl.startsWith('http') && (
                <div className="w-full h-28 rounded-lg overflow-hidden bg-muted">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" crossOrigin="anonymous" onError={() => setPreviewUrl('')} />
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleAddScene} disabled={!sceneName || !sceneUrl}>Add Scene</Button>
              </DialogFooter>
            </div>
          )}

          {uploadTab === 'samples' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Click a sample to add it as a scene.</p>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_PANORAMAS.map((sample) => (
                  <div
                    key={sample.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAddSample(sample)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSample(sample) }}
                    className="group rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors text-left cursor-pointer"
                  >
                    <div className="h-20 bg-muted relative">
                      <img src={sample.url} alt={sample.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-[11px] font-medium text-foreground">{sample.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
