"use client"

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useTour,
  updateTourSettings,
  updateTourInfo,
} from '@/lib/tour-store'

export default function SettingsPanel() {
  const tour = useTour()

  if (!tour) return null

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-5">
        {/* Tour Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tour Info</h4>
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={tour.name}
              onChange={(e) => updateTourInfo({ name: e.target.value })}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={tour.description}
              onChange={(e) => updateTourInfo({ description: e.target.value })}
              className="mt-1 text-sm min-h-[60px]"
            />
          </div>
        </div>

        <Separator />

        {/* Viewer Settings */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Viewer</h4>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground">Auto Rotate</Label>
            <Switch
              checked={tour.settings.autoRotate}
              onCheckedChange={(checked) => updateTourSettings({ autoRotate: checked })}
            />
          </div>

          {tour.settings.autoRotate && (
            <div>
              <Label className="text-xs text-muted-foreground">Rotate Speed</Label>
              <Slider
                value={[tour.settings.autoRotateSpeed]}
                onValueChange={([val]) => updateTourSettings({ autoRotateSpeed: val })}
                min={0.1}
                max={3}
                step={0.1}
                className="mt-2"
              />
              <span className="text-[10px] text-muted-foreground">{tour.settings.autoRotateSpeed}x</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground">Show Scene List</Label>
            <Switch
              checked={tour.settings.showSceneList}
              onCheckedChange={(checked) => updateTourSettings({ showSceneList: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground">Show Compass</Label>
            <Switch
              checked={tour.settings.showCompass}
              onCheckedChange={(checked) => updateTourSettings({ showCompass: checked })}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Default FOV</Label>
            <Slider
              value={[tour.settings.defaultFov]}
              onValueChange={([val]) => updateTourSettings({ defaultFov: val })}
              min={40}
              max={120}
              step={5}
              className="mt-2"
            />
            <span className="text-[10px] text-muted-foreground">{tour.settings.defaultFov} degrees</span>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Transition Duration</Label>
            <Slider
              value={[tour.settings.transitionDuration]}
              onValueChange={([val]) => updateTourSettings({ transitionDuration: val })}
              min={200}
              max={2000}
              step={100}
              className="mt-2"
            />
            <span className="text-[10px] text-muted-foreground">{tour.settings.transitionDuration}ms</span>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
