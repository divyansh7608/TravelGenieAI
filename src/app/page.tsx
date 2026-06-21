import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'TravelGenieAI - AI Travel Planner',
  description: 'Plan your perfect trip with AI. Generate complete day-by-day itineraries in seconds.',
}

interface HomePageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const params = await searchParams
  const hasError = params.error === 'auth'

  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12 sm:py-16 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 transition-colors duration-300">
        <div className="w-full max-w-2xl text-center space-y-6 sm:space-y-8">
          {/* Error */}
          {hasError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
              Authentication failed. Please try again.
            </p>
          )}

          {/* Heading */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold tracking-wide uppercase mb-2">
              ✨ Powered by Gemini AI
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
              Plan your perfect trip
              <span className="text-blue-600 dark:text-blue-400"> with AI</span>
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
              Tell us where you want to go. TravelGenieAI builds a detailed day-by-day itinerary in seconds.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            {['🗺️ Day-by-day planning', '⛅ Live weather', '💰 Budget tracking'].map((pill) => (
              <span
                key={pill}
                className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-[var(--border)] text-[var(--text-secondary)] shadow-sm font-medium"
              >
                {pill}
              </span>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto">
            <Link
              href="/auth"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Get Started →
            </Link>
            <Link
              href="/plan"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] font-medium text-base hover:bg-[var(--bg-secondary)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Continue as guest
            </Link>
          </div>

          <p className="text-xs text-[var(--text-secondary)]">
            No credit card required · Free to use
          </p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[var(--bg-secondary)] transition-colors duration-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[var(--text-primary)] mb-12">
            Everything you need to plan smarter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: '🧠',
                title: 'Smart Planning',
                desc: 'AI builds your full itinerary from a single sentence',
              },
              {
                icon: '💰',
                title: 'Budget Aware',
                desc: 'Every activity tracked against your budget in real time',
              },
              {
                icon: '✏️',
                title: 'Fully Editable',
                desc: 'Refine any part of your trip with a simple message',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-8 px-4 border-t border-[var(--border)] bg-[var(--bg)] transition-colors duration-200">
        <p className="text-center text-xs text-[var(--text-secondary)]">
          © 2026 TravelGenieAI · Built with Next.js and Gemini AI
        </p>
      </footer>
    </div>
  )
}
