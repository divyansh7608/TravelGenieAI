import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteTripAction } from '@/app/actions/trips'
import type { Trip, Preferences } from '@/types'

export const metadata: Metadata = { title: 'Dashboard - TravelGenieAI' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    user.email ??
    'Traveller'

  const { data: tripsData } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const trips = (tripsData ?? []) as Trip[]

  const { data: prefsData } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const preferences = prefsData as Preferences | null

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Welcome Hero ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--text-primary)]">
              Welcome back, {displayName} 👋
            </h1>
            <p className="text-[var(--text-secondary)] mt-1 text-sm">
              {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
            </p>
          </div>
          <Link
            href="/plan"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            + New Trip
          </Link>
        </div>

        {/* ── Travel Profile ─────────────────────────────────────────────── */}
        {preferences ? (
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Your Travel Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'Preferred Budget',
                  value: preferences.preferred_budget_range ?? '—',
                },
                {
                  label: 'Top Interests',
                  value:
                    preferences.preferred_interests.length > 0
                      ? preferences.preferred_interests.join(', ')
                      : '—',
                },
                {
                  label: 'Total Trips',
                  value: String(preferences.trip_count),
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-5 py-4 shadow-sm"
                >
                  <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1 font-medium">
                    {stat.label}
                  </p>
                  <p className="font-semibold text-[var(--text-primary)] capitalize text-sm">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Trip Cards ─────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Your Trips</h2>

          {trips.length === 0 ? (
            <div className="border border-dashed border-[var(--border)] rounded-2xl py-24 text-center bg-[var(--card)]">
              <div className="text-5xl mb-4">✈️</div>
              <p className="text-[var(--text-primary)] font-semibold text-lg mb-2">No trips yet</p>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                Plan your first trip and it will appear here
              </p>
              <Link
                href="/plan"
                className="inline-block px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200 text-sm"
              >
                Plan a Trip →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-bold text-[var(--text-primary)] leading-snug line-clamp-2">
                        {trip.destination}
                      </h2>
                      <p className="text-xs text-[var(--text-secondary)] shrink-0 mt-0.5">
                        {formatDate(trip.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                        📅 {trip.duration_days} days
                      </span>
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">
                        💰 ${trip.budget_usd.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Link
                      href={`/trip/${trip.id}`}
                      className="block w-full text-center px-3 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      View Trip →
                    </Link>
                    <form
                      action={async () => {
                        'use server'
                        await deleteTripAction(trip.id)
                      }}
                    >
                      <button
                        type="submit"
                        className="w-full text-center px-3 py-1.5 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
