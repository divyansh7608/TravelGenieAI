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

interface ORSResponse {
  routes?: {
    summary?: {
      duration?: number
    }
  }[]
}

export async function getTravelTime(origin: string, destination: string): Promise<string> {
  try {
    const [originCoords, destCoords] = await Promise.all([geocode(origin), geocode(destination)])
    if (!originCoords || !destCoords) return 'Travel time unavailable'

    const body = {
      coordinates: [
        [originCoords.longitude, originCoords.latitude],
        [destCoords.longitude, destCoords.latitude],
      ],
    }

    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        Authorization: process.env.OPENROUTE_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) return 'Travel time unavailable'

    const data = (await res.json()) as ORSResponse
    const durationSeconds = data.routes?.[0]?.summary?.duration
    if (durationSeconds === undefined) return 'Travel time unavailable'

    const minutes = Math.round(durationSeconds / 60)
    return `~${minutes} min by car`
  } catch {
    return 'Travel time unavailable'
  }
}
