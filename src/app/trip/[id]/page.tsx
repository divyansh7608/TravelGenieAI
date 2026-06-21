import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Trip } from '@/types'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import DownloadButton from './DownloadButton'

interface PageProps {
  params: Promise<{ id: string }>
}

function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min(100, Math.round((spent / total) * 100))
  const over = spent > total
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-medium">
        <span className={over ? 'text-red-600' : 'text-gray-700'}>
          ${spent.toLocaleString()} spent
        </span>
        <span className="text-gray-400">${total.toLocaleString()} budget</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">TravelGenieAI</span>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">{itinerary.title}</h1>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full border border-blue-200">
              💰 ${itinerary.total_cost_usd.toLocaleString()} total
            </span>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 text-sm font-medium rounded-full border border-purple-200">
              📅 {itinerary.days.length} days
            </span>
            <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-200">
              📍 {trip.destination}
            </span>
            <span className="px-3 py-1 bg-amber-50 text-amber-700 text-sm font-medium rounded-full border border-amber-200">
              ⭐ Best: {itinerary.best_time_to_visit}
            </span>
          </div>
          <BudgetBar spent={itinerary.total_cost_usd} total={trip.budget_usd} />
        </div>

        {/* Days */}
        {itinerary.days.map((day) => (
          <div key={day.day} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Day {day.day}</p>
                <h2 className="text-xl font-bold">{day.title}</h2>
                <p className="text-sm text-gray-300 mt-0.5">{day.date}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-white/10 text-white text-sm rounded-full border border-white/20">
                  ${day.budget_usd}
                </span>
                <p className="text-xs text-gray-400 mt-1">{day.weather}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {day.slots.map((slot, i) => (
                <div key={i} className="px-6 py-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 w-20">
                        {slot.time}
                      </span>
                      <span className="font-medium text-gray-900">{slot.activity}</span>
                    </div>
                    <span className="text-sm text-gray-500 font-medium shrink-0 ml-4">
                      ${slot.cost_usd}
                    </span>
                  </div>
                  {slot.tip && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                      💡 {slot.tip}
                    </p>
                  )}
                </div>
              ))}
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <span>🏨</span>
                  <span className="font-medium text-sm">{day.accommodation.name}</span>
                </div>
                <span className="text-sm text-slate-500">${day.accommodation.cost_usd}/night</span>
              </div>
            </div>
          </div>
        ))}

        {/* Packing tips */}
        {itinerary.packing_tips.length > 0 && (
          <div className="border border-gray-100 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-gray-900">🎒 Packing Tips</h3>
            <ul className="space-y-2">
              {itinerary.packing_tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <DownloadButton itinerary={itinerary} destination={trip.destination} />

          <Link
            href={`/plan?trip=${trip.id}`}
            className="block w-full text-center px-6 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            ✏️ Refine this trip
          </Link>

          <Link
            href="/dashboard"
            className="block w-full text-center px-6 py-3 rounded-lg bg-gray-50 text-gray-500 font-medium hover:bg-gray-100 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
