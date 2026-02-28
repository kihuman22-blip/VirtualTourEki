"use client"

import { useState } from 'react'
import { X, ArrowRight, Info, ImageIcon, FileText, Eye, Link as LinkIcon, Share2, Maximize2, Minimize2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Hotspot } from '@/lib/tour-types'

interface HotspotPopupProps {
  hotspot: Hotspot
  onClose: () => void
  onNavigate?: (sceneId: string) => void
}

function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

export default function HotspotPopup({ hotspot, onClose, onNavigate }: HotspotPopupProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const getIcon = () => {
    switch (hotspot.icon) {
      case 'eye':
        return <Eye className="h-4 w-4" />
      case 'link':
        return <LinkIcon className="h-4 w-4" />
      default:
        switch (hotspot.type) {
          case 'scene-link':
            return <ArrowRight className="h-4 w-4" />
          case 'image':
            return <ImageIcon className="h-4 w-4" />
          case 'content':
            return <FileText className="h-4 w-4" />
          default:
            return <Info className="h-4 w-4" />
        }
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const url = typeof window !== 'undefined' ? window.location.href : ''
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: do nothing
    }
  }

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none p-4">
      <div
        className={`pointer-events-auto bg-[#1a1a1a] rounded-xl shadow-[0_8px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 relative transition-all ${
          expanded
            ? 'w-[min(95vw,48rem)] max-h-[95vh]'
            : 'w-auto min-w-[200px] max-w-[min(90vw,32rem)] max-h-[85vh]'
        }`}
      >
        {/* Top action buttons */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <button
            onClick={handleShare}
            className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
          </button>
          <button
            onClick={handleExpand}
            className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image -- full bleed at top */}
        {hotspot.type === 'image' && hotspot.imageUrl && (
          <div className={`w-full overflow-hidden bg-black flex-shrink-0 ${expanded ? 'max-h-[60vh]' : 'aspect-[4/5] max-h-80'}`}>
            <img
              src={hotspot.imageUrl}
              alt={hotspot.title}
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 pr-14 overflow-y-auto">
          {/* Icon + Title row */}
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-white/50">{getIcon()}</span>
            <h3 className="font-medium text-white text-base leading-snug text-balance">{hotspot.title}</h3>
          </div>

          {/* Description */}
          {hotspot.description && (
            <p className="text-sm text-white/60 leading-relaxed mt-2 whitespace-pre-wrap break-words">{linkifyText(hotspot.description)}</p>
          )}

          {/* Content type (HTML) */}
          {hotspot.type === 'content' && hotspot.content && (
            <div
              className="text-sm text-white/60 leading-relaxed mt-2 prose prose-sm prose-invert max-w-none break-words [&_*]:break-words [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-300 [&_button]:pointer-events-auto [&_button]:cursor-pointer"
              dangerouslySetInnerHTML={{ __html: hotspot.content }}
            />
          )}

          {/* Navigate button for scene links */}
          {hotspot.type === 'scene-link' && hotspot.targetSceneId && (
            <Button
              onClick={() => onNavigate?.(hotspot.targetSceneId!)}
              className="w-full mt-4 bg-white text-black hover:bg-white/90 text-sm font-medium"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Navigate
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
