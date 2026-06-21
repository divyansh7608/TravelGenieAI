import { createClient } from '@/lib/supabase/client'
import type { Preferences, Trip } from '@/types'

export async function getPreferences(userId: string): Promise<Preferences | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as Preferences
}

function deriveBudgetRange(trips: Trip[]): string {
  if (trips.length === 0) return 'mid-range'
  const avg = trips.reduce((sum, t) => sum + t.budget_usd, 0) / trips.length
  if (avg < 1000) return 'budget'
  if (avg <= 2500) return 'mid-range'
  return 'luxury'
}

function deriveTopInterests(trips: Trip[]): string[] {
  const counts: Record<string, number> = {}
  for (const trip of trips) {
    for (const interest of trip.interests) {
      counts[interest] = (counts[interest] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([interest]) => interest)
}

export async function upsertPreferences(userId: string, trips: Trip[]): Promise<void> {
  const supabase = createClient()

  const payload = {
    user_id: userId,
    preferred_budget_range: deriveBudgetRange(trips),
    preferred_interests: deriveTopInterests(trips),
    preferred_accommodation: 'hotel',
    trip_count: trips.length,
  }

  const { error } = await supabase
    .from('preferences')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) throw new Error(`Failed to upsert preferences: ${error.message}`)
}
