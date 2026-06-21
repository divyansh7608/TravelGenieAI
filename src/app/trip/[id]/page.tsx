import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Trip } from '@/types'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import DownloadButton from './DownloadButton'

export const metadata: Metadata = { title: 'Trip Details - TravelGenieAI' }

interface PageProps {
  params: Promise<{ id: string }>
}

function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min(100, Math.round((spent / total) * 100))
  const over = spent > total
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm font-medium">
        <span className={over ? 'text-red-500' : 'text-[var(--text-primary)]'}>
          ${spent.toLocaleString()} spent
        </span>
        <span className="text-[var(--text-secondary)]">
          ${total.toLocaleString()} budget · {pct}%
        </span>
      </div>
      <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-400' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default async function TripPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: tripData, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !tripData) redirect('/dashboard')

  const trip = tripData as Trip
  const itinerary = trip.itinerary as unknown as ItineraryShape

  return (
    <div className="min-h-screen bg-[var(--bg)] transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-primary)] leading-tight">
              {itinerary.title}
            </h1>
            <DownloadButton itinerary={itinerary} destination={trip.destination} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium rounded-full border border-green-200 dark:border-green-800">
              💰 ${itinerary.total_cost_usd.toLocaleString()} total
            </span>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full border border-blue-200 dark:border-blue-800">
              📅 {itinerary.days.length} days
            </span>
            <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-full border border-purple-200 dark:border-purple-800">
              📍 {trip.destination}
            </span>
          </div>

          {/* Best time banner */}
          {itinerary.best_time_to_visit && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
              ⭐ <span className="font-medium">Best time to visit:</span> {itinerary.best_time_to_visit}
            </div>
          )}

          <BudgetBar spent={itinerary.total_cost_usd} total={trip.budget_usd} />
        </div>

        {/* Days */}
        {itinerary.days.map((day) => (
          <div key={day.day} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
            {/* Day header */}
            <div className="px-3 sm:px-5 py-4 flex items-start justify-between gap-3 border-b border-[var(--border)]">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    {day.day}
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{day.title}</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)] ml-8 sm:ml-9 line-clamp-1">{day.date} · {day.weather}</p>
              </div>
              <span className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                ${day.budget_usd}
              </span>
            </div>

            {/* Slots */}
            <div className="divide-y divide-[var(--border)]">
              {day.slots.map((slot, i) => (
                <div key={i} className="px-3 sm:px-5 py-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 min-w-0">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] shrink-0">
                        {slot.time}
                      </span>
                      <span className="font-medium text-[var(--text-primary)] text-sm leading-snug">
                        {slot.activity}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-semibold shrink-0 mt-0.5">
                      ${slot.cost_usd}
                    </span>
                  </div>
                  {slot.tip && (
                    <p className="text-xs text-[var(--text-secondary)] italic pl-3 border-l-2 border-blue-300 dark:border-blue-700">
                      💡 {slot.tip}
                    </p>
                  )}
                </div>
              ))}

              {/* Accommodation */}
              <div className="px-3 sm:px-5 py-3.5 flex items-center justify-between bg-[var(--bg-secondary)] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">🏨</span>
                  <span className="font-medium text-sm text-[var(--text-primary)] truncate">{day.accommodation.name}</span>
                </div>
                <span className="text-sm text-[var(--text-secondary)] shrink-0">${day.accommodation.cost_usd}/night</span>
              </div>
            </div>
          </div>
        ))}

        {/* Packing tips */}
        {itinerary.packing_tips.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-amber-900 dark:text-amber-200">🎒 Packing Tips</h3>
            <ul className="space-y-1.5">
              {itinerary.packing_tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href={`/plan?trip=${trip.id}`}
            className="flex-1 text-center px-6 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✏️ Refine this trip
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 text-center px-6 py-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium hover:bg-[var(--border)] transition-colors duration-200 text-sm"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
