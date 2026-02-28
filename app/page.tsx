import Link from 'next/link'
import {
  ArrowRight,
  Compass,
  Layers,
  MousePointerClick,
  Eye,
  Share2,
  Palette,
  Zap,
  Globe,
  ImageIcon,
  Navigation,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import AuthNavbar from '@/components/auth-navbar'

function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 px-6 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_50%)] opacity-[0.08]" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-secondary/50 border border-border rounded-full px-4 py-1.5 mb-8">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">Professional 360 Tour Builder</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-foreground tracking-tight leading-[1.1] text-balance">
          Create immersive
          <br />
          <span className="text-primary">virtual tours</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
          Build stunning 360-degree panoramic experiences with interactive hotspots,
          seamless scene transitions, and professional navigation. No coding required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link href="/auth/sign-up">
            <Button size="lg" className="text-base gap-2 h-12 px-8">
              Start Building
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/viewer">
            <Button variant="outline" size="lg" className="text-base gap-2 h-12 px-8">
              <Eye className="h-4 w-4" />
              View Demo Tour
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16">
          {[
            { value: '360\u00b0', label: 'Panoramic View' },
            { value: 'Unlimited', label: 'Scenes & Hotspots' },
            { value: 'Instant', label: 'Share & Embed' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hero preview */}
      <div className="max-w-5xl mx-auto mt-20 relative">
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xl shadow-primary/5">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-secondary/30">
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
            <span className="text-[10px] text-muted-foreground ml-3">PanoraVista Editor</span>
          </div>
          <div className="aspect-[16/9] bg-secondary relative overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1920&h=1080&fit=crop"
              alt="Virtual tour editor preview showing a panoramic scene"
              className="w-full h-full object-cover opacity-70"
              crossOrigin="anonymous"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            {/* Fake hotspot indicators */}
            <div className="absolute top-1/3 left-1/4 h-10 w-10 rounded-full bg-primary/80 border-2 border-primary-foreground/50 flex items-center justify-center animate-pulse">
              <Navigation className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="absolute top-1/2 right-1/3 h-10 w-10 rounded-full bg-accent/80 border-2 border-accent-foreground/50 flex items-center justify-center">
              <MousePointerClick className="h-4 w-4 text-accent-foreground" />
            </div>
            {/* Scene bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-secondary/80 backdrop-blur rounded-lg p-2">
              {['Lobby', 'Office', 'Gallery'].map((name) => (
                <div key={name} className="w-16 h-10 rounded bg-muted flex items-center justify-center">
                  <span className="text-[8px] text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const features = [
    {
      icon: <Compass className="h-5 w-5" />,
      title: '360\u00b0 Panorama Viewer',
      description: 'Render equirectangular images on a seamless sphere with smooth mouse and touch controls for an immersive experience.',
    },
    {
      icon: <MousePointerClick className="h-5 w-5" />,
      title: 'Interactive Hotspots',
      description: 'Add clickable points that display information, images, rich content, or navigate to other scenes in your tour.',
    },
    {
      icon: <Layers className="h-5 w-5" />,
      title: 'Multi-Scene Tours',
      description: 'Connect unlimited panoramic scenes together with smooth transitions to create comprehensive virtual experiences.',
    },
    {
      icon: <Palette className="h-5 w-5" />,
      title: 'Full Customization',
      description: 'Customize hotspot colors, icons, viewer settings, auto-rotation, field of view, and transition effects.',
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      title: 'Share & Embed',
      description: 'Export your tours as JSON, generate embed codes for websites, and share immersive experiences with anyone.',
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Real-Time Editor',
      description: 'Visual editor with live preview. Place hotspots by clicking directly on the panorama and configure them instantly.',
    },
  ]

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary mb-3">FEATURES</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
            Everything you need to build virtual tours
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-pretty">
            Professional-grade tools for creating, customizing, and sharing immersive 360-degree panoramic experiences.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-6 hover:bg-secondary/50 hover:border-primary/20 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-card-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      title: 'Upload Panoramas',
      description: 'Add 360-degree equirectangular images from your device or use our sample panoramas to get started quickly.',
      icon: <ImageIcon className="h-6 w-6" />,
    },
    {
      step: '02',
      title: 'Add Hotspots',
      description: 'Click anywhere on the panorama to place interactive hotspots. Choose from scene links, info points, images, or custom content.',
      icon: <MousePointerClick className="h-6 w-6" />,
    },
    {
      step: '03',
      title: 'Connect Scenes',
      description: 'Link your scenes together using scene-link hotspots. Create a natural flow that guides viewers through your virtual space.',
      icon: <Navigation className="h-6 w-6" />,
    },
    {
      step: '04',
      title: 'Share & Embed',
      description: 'Export your finished tour, generate an embed code, or share a direct link. Your tour is ready to be experienced by anyone.',
      icon: <Globe className="h-6 w-6" />,
    },
  ]

  return (
    <section id="how-it-works" className="py-24 px-6 bg-secondary/20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary mb-3">HOW IT WORKS</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
            Build a tour in minutes
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-pretty">
            Our intuitive editor makes it easy to create professional virtual tours without any technical knowledge.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((step, i) => (
            <div key={step.step} className="flex gap-5 p-6 rounded-xl bg-card border border-border">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {step.icon}
                </div>
              </div>
              <div>
                <span className="text-xs font-mono text-primary/60">{step.step}</span>
                <h3 className="text-base font-semibold text-card-foreground mt-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UseCasesSection() {
  const useCases = [
    { name: 'Real Estate', desc: 'Showcase properties with immersive virtual walkthroughs.' },
    { name: 'Hospitality', desc: 'Let guests explore hotels, resorts, and venues before booking.' },
    { name: 'Museums', desc: 'Create virtual exhibitions accessible from anywhere in the world.' },
    { name: 'Education', desc: 'Build interactive campus tours and virtual field trips.' },
    { name: 'Retail', desc: 'Give customers a 360-degree view of your store and products.' },
    { name: 'Architecture', desc: 'Present building designs and spaces in stunning detail.' },
  ]

  return (
    <section id="use-cases" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary mb-3">USE CASES</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
            Built for every industry
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {useCases.map((uc) => (
            <div key={uc.name} className="p-5 rounded-xl border border-border bg-card hover:bg-secondary/40 transition-colors">
              <h3 className="text-sm font-semibold text-card-foreground">{uc.name}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{uc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="rounded-2xl border border-border bg-card p-12 md:p-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.05]" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-card-foreground tracking-tight text-balance">
              Ready to create your first tour?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto text-pretty">
              Create an account and start building immersive 360-degree experiences in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Link href="/auth/sign-up">
                <Button size="lg" className="text-base gap-2 h-12 px-8">
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg" className="text-base h-12 px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
            <Compass className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">PanoraVista</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Professional 360-degree virtual tour creation platform
        </p>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link href="/viewer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Demo
          </Link>
          <Link href="/auth/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <AuthNavbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <UseCasesSection />
      <CTASection />
      <Footer />
    </main>
  )
}
