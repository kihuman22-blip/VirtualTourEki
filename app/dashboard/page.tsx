'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Compass,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Eye,
  LogOut,
  Layers,
  Globe,
  Lock,
  Share2,
  ExternalLink,
  Check,
  Link2,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface TourRow {
  id: string
  name: string
  description: string | null
  tour_data: Record<string, unknown>
  is_public: boolean
  scene_count: number
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tours, setTours] = useState<TourRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchTours = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data } = await supabase
      .from('tours')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setTours(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)
    }
    getUser()
    fetchTours()
  }, [supabase, router, fetchTours])

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleNewTour = () => {
    router.push('/editor')
  }

  const handleEditTour = (tourId: string) => {
    router.push(`/editor?id=${tourId}`)
  }

  const handleDuplicateTour = async (tour: TourRow) => {
    if (!supabase) return
    const { error } = await supabase.from('tours').insert({
      user_id: user?.id,
      name: `${tour.name} (copy)`,
      description: tour.description,
      tour_data: tour.tour_data,
      is_public: false,
      scene_count: tour.scene_count,
      thumbnail_url: tour.thumbnail_url,
    })
    if (!error) fetchTours()
  }

  const handleTogglePublic = async (tourId: string, currentlyPublic: boolean) => {
    if (!supabase) return
    await supabase.from('tours').update({ is_public: !currentlyPublic }).eq('id', tourId)
    fetchTours()
  }

  const [copiedTourId, setCopiedTourId] = useState<string | null>(null)

  const handleCopyShareLink = async (tourId: string) => {
    const url = `${window.location.origin}/tour/${tourId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedTourId(tourId)
      setTimeout(() => setCopiedTourId(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleDeleteTour = async () => {
    if (!deleteId || !supabase) return
    await supabase.from('tours').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchTours()
  }

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Compass className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-foreground">PanoraVista</span>
          </Link>

          <div className="flex items-center gap-4">
            <Button onClick={handleNewTour} className="gap-2">
              <Plus className="h-4 w-4" />
              New Tour
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-foreground hidden sm:inline">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">My Tours</h1>
          <p className="text-muted-foreground">
            Create and manage your virtual tour experiences.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-xl border border-border bg-card animate-pulse">
                <div className="h-44 bg-secondary rounded-t-xl" />
                <div className="p-4 flex flex-col gap-3">
                  <div className="h-5 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : tours.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
              <Layers className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No tours yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-pretty leading-relaxed">
              Create your first virtual tour by uploading 360-degree panorama images and connecting them with navigation arrows.
            </p>
            <Button onClick={handleNewTour} size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first tour
            </Button>
          </div>
        ) : (
          /* Tour grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tours.map((tour) => (
              <div
                key={tour.id}
                className="group rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/30"
              >
                {/* Thumbnail */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEditTour(tour.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditTour(tour.id) }}
                  className="relative h-44 bg-secondary cursor-pointer overflow-hidden"
                >
                  {tour.thumbnail_url ? (
                    <img
                      src={tour.thumbnail_url}
                      alt={tour.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Compass className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      Open editor
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate">{tour.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {tour.scene_count} {tour.scene_count === 1 ? 'scene' : 'scenes'}
                        </span>
                        <span className="flex items-center gap-1">
                          {tour.is_public ? (
                            <>
                              <Globe className="h-3 w-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              Private
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated {new Date(tour.updated_at).toLocaleDateString()}
                      </p>
                      {tour.is_public && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyShareLink(tour.id)
                            }}
                          >
                            {copiedTourId === tour.id ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Share2 className="h-3 w-3" />
                            )}
                            {copiedTourId === tour.id ? 'Copied' : 'Share'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/tour/${tour.id}`)
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Tour options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleEditTour(tour.id)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {tour.is_public && (
                          <DropdownMenuItem onClick={() => router.push(`/tour/${tour.id}`)}>
                            <ExternalLink className="h-4 w-4" />
                            View public tour
                          </DropdownMenuItem>
                        )}
                        {tour.is_public && (
                          <DropdownMenuItem onClick={() => handleCopyShareLink(tour.id)}>
                            {copiedTourId === tour.id ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                            {copiedTourId === tour.id ? 'Link copied!' : 'Copy share link'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleTogglePublic(tour.id, tour.is_public)}>
                          {tour.is_public ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                          {tour.is_public ? 'Make private' : 'Make public'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDuplicateTour(tour)}>
                          <Copy className="h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(tour.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tour?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The tour and all its scenes and hotspots will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTour} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
