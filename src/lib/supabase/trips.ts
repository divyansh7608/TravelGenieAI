import { createClient } from '@/lib/supabase/client'
import type { Trip } from '@/types'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import type { GenerateRequest } from '@/types'

export async function saveTrip(
  userId: string,
  itinerary: ItineraryShape,
  request: GenerateRequest
): Promise<string> {
  const supabase = createClient()
  const now = new Date().toISOString()

  // Ensure profile exists to prevent foreign key errors ('trips.user_id' -> 'profiles.id')
  // This handles users signed in via Google OAuth or whose profile creation failed during sign-up
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.id === userId) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      avatar_url: user.user_metadata?.avatar_url || ''
    }, { onConflict: 'id' })
    
    if (profileError) {
      console.error('Lazy profile creation failed:', profileError)
      throw new Error(`Could not create profile: ${profileError.message}. Please check database RLS policies.`)
    }
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: userId,
      title: itinerary.title,
      destination: request.destination,
      duration_days: request.duration_days,
      budget_usd: request.budget_usd,
      interests: request.interests,
      itinerary: itinerary,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save trip: ${error.message}`)
  return data.id as string
}

export async function getUserTrips(userId: string): Promise<Trip[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch trips: ${error.message}`)
  return (data ?? []) as Trip[]
}

export async function getTripById(tripId: string, userId: string): Promise<Trip | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as Trip
}

export async function deleteTrip(tripId: string, userId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to delete trip: ${error.message}`)
}

export async function updateTripItinerary(
  tripId: string,
  userId: string,
  itinerary: ItineraryShape
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('trips')
    .update({ itinerary, updated_at: new Date().toISOString() })
    .eq('id', tripId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to update trip: ${error.message}`)
}
