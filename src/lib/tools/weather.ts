interface GeocodingResult {
  latitude: number
  longitude: number
}

async function geocode(location: string): Promise<GeocodingResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: { latitude: number; longitude: number }[] }
    const first = data.results?.[0]
    if (!first) return null
    return { latitude: first.latitude, longitude: first.longitude }
  } catch {
    return null
  }
}

export async function getWeather(destination: string, date: string): Promise<string> {
  try {
    const coords = await geocode(destination)
    if (!coords) return 'Weather data unavailable'

    const { latitude, longitude } = coords
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`

    const res = await fetch(url)
    if (!res.ok) return 'Weather data unavailable'

    const data = (await res.json()) as {
      daily?: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_max: number[]
      }
    }

    const daily = data.daily
    if (!daily) return 'Weather data unavailable'

    // Find the index for the requested date, fall back to first available day
    const idx = Math.max(0, daily.time.indexOf(date))

    const max = Math.round(daily.temperature_2m_max[idx])
    const min = Math.round(daily.temperature_2m_min[idx])
    const rain = daily.precipitation_probability_max[idx] ?? 0

    return `${max}°C max, ${min}°C min, ${rain}% rain chance`
  } catch {
    return 'Weather data unavailable'
  }
}
