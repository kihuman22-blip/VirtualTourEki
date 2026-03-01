import { createClient } from '@/lib/supabase/client'

const BUCKET = 'tour-images'

/**
 * Upload a File to Supabase Storage under the current user's folder.
 * Returns the permanent public URL. Falls back to object URL if not authenticated.
 * Supports images and PDF files.
 */
export async function uploadTourImage(
  file: File,
  folder: 'scenes' | 'hotspots' | 'files' = 'scenes'
): Promise<string> {
  const supabase = createClient()
  if (!supabase) {
    console.warn('[v0] Supabase not configured, using local object URL')
    return URL.createObjectURL(file)
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.warn('[v0] Not authenticated, using local object URL')
    return URL.createObjectURL(file)
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${user.id}/${folder}/${fileName}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })

  if (error) {
    console.error('[v0] Storage upload failed:', error.message)
    return URL.createObjectURL(file)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Check if a URL is a temporary blob URL.
 */
export function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:')
}

/**
 * Re-upload a blob URL's data to Supabase Storage.
 * Returns permanent URL, or the original if it's already permanent or upload fails.
 */
export async function persistBlobUrl(
  blobUrl: string,
  folder: 'scenes' | 'hotspots' | 'files' = 'scenes'
): Promise<string> {
  if (!isBlobUrl(blobUrl)) return blobUrl

  try {
    const resp = await fetch(blobUrl)
    const blob = await resp.blob()
    const ext = blob.type.split('/')[1] || 'jpg'
    const file = new File([blob], `image.${ext}`, { type: blob.type })
    return await uploadTourImage(file, folder)
  } catch (err) {
    console.error('[v0] Failed to persist blob URL:', err)
    return blobUrl
  }
}
