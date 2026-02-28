import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TourNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6">
          <Compass className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Tour Not Found</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed text-pretty">
          This tour does not exist, has been removed, or is not publicly shared. Ask the owner to make it public if you believe this is a mistake.
        </p>
        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  )
}
