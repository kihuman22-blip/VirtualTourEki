import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Tour } from '@/lib/tour-types'
import PublicTourViewer from './public-tour-viewer'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  if (!supabase) {
    return { title: 'Tour - PanoraVista' }
  }

  const { data } = await supabase
    .from('tours')
    .select('name, description')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!data) {
    return { title: 'Tour Not Found - PanoraVista' }
  }

  return {
    title: `${data.name} - PanoraVista`,
    description: data.description || 'An immersive 360 virtual tour experience',
    openGraph: {
      title: `${data.name} - PanoraVista`,
      description: data.description || 'An immersive 360 virtual tour experience',
      type: 'website',
    },
  }
}

export default async function PublicTourPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  if (!supabase) {
    notFound()
  }

  const { data, error } = await supabase
    .from('tours')
    .select('id, name, description, tour_data, is_public')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !data) {
    notFound()
  }

  const tourData = data.tour_data as unknown as Tour

  return <PublicTourViewer tour={tourData} tourName={data.name} />
}
