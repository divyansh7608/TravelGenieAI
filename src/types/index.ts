export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string
  created_at: string
}

export interface ItinerarySlot {
  time: string
  activity: string
  cost_usd: number
  tip?: string
}

export interface Accommodation {
  name: string
  cost_usd: number
}

export interface ItineraryDay {
  day: number
  title: string
  date: string
  weather: string
  budget_usd: number
  slots: ItinerarySlot[]
  accommodation: Accommodation
}

export interface Trip {
  id: string
  user_id?: string
  title: string
  destination: string
  duration_days: number
  budget_usd: number
  interests: string[]
  itinerary: ItineraryDay[]
  created_at: string
  updated_at: string
}

export interface Preferences {
  id: string
  user_id: string
  preferred_budget_range: string
  preferred_interests: string[]
  preferred_accommodation: string
  trip_count: number
}

export interface GenerateRequest {
  destination: string
  duration_days: number
  budget_usd: number
  interests: string[]
  dates?: string
  group_size?: string
  extra_notes?: string
}
