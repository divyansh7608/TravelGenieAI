import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'
import { deleteTripAction } from '@/app/actions/trips'
import type { Trip, Preferences } from '@/types'

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
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Traveller'

  // Fetch trips
  const { data: tripsData } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const trips = (tripsData ?? []) as Trip[]

  // Fetch preferences
  const { data: prefsData } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const preferences = prefsData as Preferences | null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">TravelGenieAI</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Welcome + CTA */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {displayName}!</h1>
            <p className="text-gray-500 mt-1">
              {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
            </p>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-700 transition-colors"
          >
            + New Trip
          </Link>
        </div>

        {/* Preferences strip */}
        {preferences && (
          <div className="bg-white border border-gray-100 rounded-2xl px-6 py-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Budget style</p>
              <p className="font-semibold text-gray-800 capitalize">{preferences.preferred_budget_range}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Top interests</p>
              <p className="font-semibold text-gray-800">
                {preferences.preferred_interests.length > 0
                  ? preferences.preferred_interests.join(', ')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Trips planned</p>
              <p className="font-semibold text-gray-800">{preferences.trip_count}</p>
            </div>
          </div>
        )}

        {/* Trip cards */}
        {trips.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-2xl py-24 text-center bg-white">
            <p className="text-gray-400 text-base mb-4">
              No trips yet — plan your first one.
            </p>
            <Link
              href="/plan"
              className="inline-block px-5 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-700 transition-colors text-sm"
            >
              Plan a trip
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
              >
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    {formatDate(trip.created_at)}
                  </p>
                  <h2 className="text-base font-bold text-gray-900 leading-snug line-clamp-2">
                    {trip.destination}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {trip.duration_days} days · ${trip.budget_usd.toLocaleString()} budget
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/trip/${trip.id}`}
                    className="flex-1 text-center px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    View Trip
                  </Link>
                  <form
                    action={async () => {
                      'use server'
                      await deleteTripAction(trip.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg border border-red-100 text-red-400 text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
