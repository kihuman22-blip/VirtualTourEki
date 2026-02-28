"use client"

import { useState } from 'react'
import {
  Download,
  Upload,
  Eye,
  Share2,
  Copy,
  Check,
  ArrowLeft,
  Save,
  Loader2,
  Cloud,
  CloudOff,
  Archive,
  Link2,
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useTour, exportTour, importTour } from '@/lib/tour-store'
import { exportTourAsZip } from '@/lib/tour-export'
import Link from 'next/link'

interface EditorToolbarProps {
  saving?: boolean
  lastSaved?: string | null
  onSaveNow?: () => void
}

export default function EditorToolbar({ saving, lastSaved, onSaveNow }: EditorToolbarProps) {
  const tour = useTour()
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [zipExporting, setZipExporting] = useState(false)
  const [zipProgress, setZipProgress] = useState<{ label: string; percent: number } | null>(null)

  const handleExportJson = () => {
    const json = exportTour()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tour?.name || 'tour'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportZip = async () => {
    if (!tour) return
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
      a.download = `${tour.name.toLowerCase().replace(/\s+/g, '-')}-tour.zip`
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

  const handleImport = () => {
    const success = importTour(importJson)
    if (success) {
      setShowImport(false)
      setImportJson('')
    }
  }

  const getTourUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const tourId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null
    return tourId ? `${origin}/tour/${tourId}` : `${origin}/viewer`
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getTourUrl())
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyEmbed = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const tourId = new URLSearchParams(window.location.search).get('id')
    const embedUrl = tourId ? `${origin}/viewer?id=${tourId}` : `${origin}/viewer`
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="h-12 border-b border-border bg-card flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">
              {tour?.name || 'Untitled Tour'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {tour?.scenes.length || 0} scenes
            </p>
          </div>

          {/* Save status indicator */}
          <div className="flex items-center gap-1.5 ml-3">
            {saving ? (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Cloud className="h-3 w-3 text-accent" />
                Saved {lastSaved}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onSaveNow && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={onSaveNow}
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowImport(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleExportZip}
            disabled={zipExporting}
          >
            {zipExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            {zipExporting ? 'Exporting...' : 'Export ZIP'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowShare(true)}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          <Link
            href={(() => {
              const tourId =
                typeof window !== 'undefined'
                  ? new URLSearchParams(window.location.search).get('id')
                  : null
              return tourId ? `/viewer?id=${tourId}` : '/viewer'
            })()}
          >
            <Button size="sm" className="h-8 text-xs gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </Link>
        </div>
      </div>

      {/* ZIP export progress bar */}
      {zipProgress && (
        <div className="h-6 border-b border-border bg-card flex items-center px-3 gap-2">
          <Progress value={zipProgress.percent} className="h-1.5 flex-1 max-w-xs" />
          <span className="text-[10px] text-muted-foreground">{zipProgress.label}</span>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Import Tour</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Paste a tour JSON export to load it into the editor.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste tour JSON here..."
            className="min-h-[200px] font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importJson}>
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share / Embed Dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Share Tour</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Share a direct link or embed this tour on any website.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {/* Direct link */}
            <div>
              <Label className="text-xs font-medium text-foreground">Direct Link</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Anyone with this link can view the tour.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="flex-1 h-9 rounded-md border border-border bg-muted/50 px-3 text-xs font-mono text-foreground focus:outline-none"
                  value={getTourUrl()}
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0" onClick={handleCopyLink}>
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Embed code */}
            <div>
              <Label className="text-xs font-medium text-foreground">Embed Code</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Paste this into your website HTML to embed the tour.
              </p>
              <div className="relative">
                <Textarea
                  readOnly
                  className="min-h-[72px] font-mono text-xs pr-12"
                  value={`<iframe src="${getTourUrl()}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleCopyEmbed}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Export JSON */}
            <div>
              <Label className="text-xs font-medium text-foreground">Export Tour</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                Download as a complete ZIP with standalone viewer (works offline, on GitHub Pages, etc.) or as raw JSON data.
              </p>
              <div className="flex flex-col gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 w-full justify-start"
                  onClick={handleExportZip}
                  disabled={zipExporting}
                >
                  {zipExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" />
                  )}
                  {zipExporting ? 'Exporting...' : 'Download as ZIP (recommended)'}
                </Button>
                {zipProgress && (
                  <div className="space-y-1.5">
                    <Progress value={zipProgress.percent} className="h-1.5" />
                    <p className="text-[11px] text-muted-foreground">{zipProgress.label}</p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 w-full justify-start text-muted-foreground"
                  onClick={handleExportJson}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download as JSON
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
