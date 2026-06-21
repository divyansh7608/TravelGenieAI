import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GenerateRequest } from '@/types'
import { buildOrchestratorPrompt, buildCriticPrompt } from './prompts'
import { getWeather } from '@/lib/tools/weather'
import { getTravelTime } from '@/lib/tools/routing'

// Aggressively clean Gemini response to extract raw JSON
function cleanJson(text: string): string {
  let cleaned = text.trim()

  cleaned = cleaned.replace(/^```json/i, '')
  cleaned = cleaned.replace(/^```/i, '')
  cleaned = cleaned.replace(/```$/i, '')

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned.trim()
}

function sseChunk(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}

function getDateInDays(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

export interface ItineraryShape {
  title: string
  days: {
    day: number
    title: string
    date: string
    weather: string
    budget_usd: number
    slots: {
      time: string
      activity: string
      cost_usd: number
      tip?: string
    }[]
    accommodation: {
      name: string
      cost_usd: number
    }
  }[]
  total_cost_usd: number
  packing_tips: string[]
  best_time_to_visit: string
}

export async function* runAgent(request: GenerateRequest): AsyncGenerator<string> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
    })

    // ── Step 1: Orchestrator ─────────────────────────────────────────────────
    yield sseChunk('status', 'Searching for attractions and hotels')

    const systemPrompt = buildOrchestratorPrompt(request)
    const userMessage = `Plan a ${request.duration_days}-day trip to ${request.destination} for $${request.budget_usd} budget.`

    const orchestratorResult = await model.generateContent([
      { text: systemPrompt },
      { text: userMessage },
    ])

    const rawItineraryText = orchestratorResult.response.text()
    const itinerary = JSON.parse(cleanJson(rawItineraryText)) as ItineraryShape

    // ── Step 2: Weather ──────────────────────────────────────────────────────
    yield sseChunk('status', 'Fetching weather forecast')

    const startDate = request.dates
      ? request.dates.split(/[\s,–-]+/)[0]?.trim() ?? getDateInDays(30)
      : getDateInDays(30)

    const weather = await getWeather(request.destination, startDate)

    if (itinerary.days[0]) {
      itinerary.days[0].weather = weather
    }

    // ── Step 3: Routing ──────────────────────────────────────────────────────
    yield sseChunk('status', 'Calculating routes')

    const firstDay = itinerary.days[0]
    const firstSlot = firstDay?.slots[0]

    if (firstDay && firstSlot) {
      const travelTime = await getTravelTime(
        `${request.destination} city centre`,
        firstSlot.activity
      )
      firstSlot.tip = firstSlot.tip
        ? `${firstSlot.tip} — ${travelTime} from city centre.`
        : `${travelTime} from city centre.`
    }

    // ── Step 4: Critic ───────────────────────────────────────────────────────
    yield sseChunk('status', 'Reviewing and refining plan')

    let finalItinerary: ItineraryShape = itinerary

    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const criticResult = await model.generateContent([
        { text: buildCriticPrompt(JSON.stringify(itinerary), request) },
      ])
      const rawCriticText = criticResult.response.text()
      finalItinerary = JSON.parse(cleanJson(rawCriticText)) as ItineraryShape
    } catch (criticError) {
      console.error('Critic step failed, falling back to original itinerary:', criticError)
    }

    // ── Step 5: Done ─────────────────────────────────────────────────────────
    yield sseChunk('done', JSON.stringify(finalItinerary))
  } catch (err) {
    console.error('Agent error:', err)

    const message = err instanceof Error ? err.message : String(err)

    const status =
      typeof err === "object" &&
        err !== null &&
        "status" in err
        ? Number((err as { status?: number }).status)
        : undefined;

    if (
      status === 429 ||
      message.toLowerCase().includes("too many requests")
    ) {
      yield sseChunk('error', 'Rate limit reached. Please wait a moment and try again.')
      return
    }

    yield sseChunk('error', message)
  }
}
