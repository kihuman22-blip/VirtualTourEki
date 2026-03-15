"use client"

import { useState, useEffect, useRef } from 'react'
import { X, ArrowRight, Info, ImageIcon, FileText, Eye, Link as LinkIcon, Share2, Maximize2, Minimize2, Check, FileDown, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | 'square'>('landscape')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)
  
  // Get all images (from images array or single imageUrl for backwards compatibility)
  const allImages = hotspot.images && hotspot.images.length > 0 
    ? hotspot.images 
    : hotspot.imageUrl 
      ? [hotspot.imageUrl] 
      : []
  const hasMultipleImages = allImages.length > 1
  const currentImageUrl = allImages[currentImageIndex] || ''

  // Detect image orientation on load
  useEffect(() => {
    if ((hotspot.type === 'image' || hotspot.type === 'info') && currentImageUrl) {
      setImageLoaded(false)
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight
        if (ratio < 0.85) {
          setImageOrientation('portrait')
        } else if (ratio > 1.15) {
          setImageOrientation('landscape')
        } else {
          setImageOrientation('square')
        }
        setImageLoaded(true)
      }
      img.onerror = () => setImageLoaded(true)
      img.src = currentImageUrl
    }
  }, [hotspot.type, currentImageUrl])
  
  // Reset image index when hotspot changes
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [hotspot.id])
  
  const goToPrevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))
  }
  
  const goToNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))
  }

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

  const hasPdf = !!hotspot.pdfUrl
  const hasImage = (hotspot.type === 'image' || hotspot.type === 'info') && allImages.length > 0

  // Adaptive popup sizing based on image orientation
  const getPopupClasses = () => {
    if (expanded) {
      return 'w-[min(95vw,56rem)] max-h-[95vh]'
    }
    if (hasPdf) {
      return 'w-[min(95vw,48rem)] max-h-[90vh]'
    }
    if (hasImage && imageLoaded) {
      switch (imageOrientation) {
        case 'portrait':
          return 'w-[min(90vw,22rem)] sm:w-[min(90vw,24rem)] max-h-[90vh]'
        case 'landscape':
          return 'w-[min(95vw,36rem)] sm:w-[min(90vw,40rem)] max-h-[85vh]'
        case 'square':
          return 'w-[min(90vw,28rem)] sm:w-[min(90vw,32rem)] max-h-[90vh]'
      }
    }
    return 'w-auto min-w-[200px] max-w-[min(90vw,32rem)] max-h-[85vh]'
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none p-2 sm:p-4">
      <div
        className={`pointer-events-auto bg-[#1a1a1a] rounded-xl shadow-[0_8px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 relative transition-all ${getPopupClasses()}`}
      >
        {/* Top action buttons */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={handleShare}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-400" /> : <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>
          <button
            onClick={handleExpand}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>
          <button
            onClick={onClose}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>

        {/* Image -- adaptive sizing, no black borders */}
        {hasImage && (
          <div className={`relative w-full overflow-hidden flex-shrink-0 flex items-center justify-center ${expanded ? 'max-h-[65vh]' : ''}`}>
            <img
              ref={imgRef}
              src={currentImageUrl}
              alt={hotspot.title}
              className={`w-full h-auto object-cover rounded-t-xl ${expanded ? 'max-h-[65vh]' : imageOrientation === 'portrait' ? 'max-h-[60vh]' : imageOrientation === 'landscape' ? 'max-h-[50vh]' : 'max-h-[55vh]'}`}
              crossOrigin="anonymous"
            />
            
            {/* Navigation arrows for multiple images */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={goToPrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                  title="Vorheriges Bild"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                  title="Nächstes Bild"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                
                {/* Image counter */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-white/90 text-xs font-medium">
                  {currentImageIndex + 1} / {allImages.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* PDF viewer */}
        {hasPdf && (
          <div className={`w-full flex-shrink-0 bg-[#222] ${expanded ? 'flex-1 min-h-[60vh]' : 'h-[50vh] sm:h-[55vh]'}`}>
            <iframe
              src={hotspot.pdfUrl}
              className="w-full h-full border-0"
              title={`PDF: ${hotspot.title}`}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-3 pr-12 sm:p-5 sm:pr-14 overflow-y-auto">
          {/* Icon + Title row */}
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-white/50">{getIcon()}</span>
            <h3 className="font-medium text-white text-sm sm:text-base leading-snug text-balance">{hotspot.title}</h3>
          </div>

          {/* Description */}
          {hotspot.description && (
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed mt-2 whitespace-pre-wrap break-words">{linkifyText(hotspot.description)}</p>
          )}

          {/* Content type (HTML) */}
          {hotspot.type === 'content' && hotspot.content && (
            <div
              className="text-xs sm:text-sm text-white/60 leading-relaxed mt-2 prose prose-sm prose-invert max-w-none break-words [&_*]:break-words [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-300 [&_button]:pointer-events-auto [&_button]:cursor-pointer"
              dangerouslySetInnerHTML={{ __html: hotspot.content }}
            />
          )}

          {/* PDF download link */}
          {hasPdf && (
            <a
              href={hotspot.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF herunterladen
            </a>
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
