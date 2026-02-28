import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MailCheck, ArrowLeft } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
          <MailCheck className="h-8 w-8 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Check your email</h1>
        <p className="text-muted-foreground leading-relaxed mb-8 text-pretty">
          {"We've sent you a confirmation link. Click the link in your email to activate your account and start creating virtual tours."}
        </p>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/auth/login">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </Button>
      </div>
    </div>
  )
}
