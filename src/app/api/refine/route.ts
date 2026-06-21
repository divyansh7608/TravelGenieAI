export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import type { GenerateRequest } from '@/types'

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

interface RefineBody {
  itinerary: ItineraryShape
  request: GenerateRequest
  message: string
}

export async function POST(req: NextRequest) {
  let body: Partial<RefineBody>

  try {
    body = (await req.json()) as Partial<RefineBody>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { itinerary, request, message } = body

  if (!itinerary || !request || !message) {
    return NextResponse.json(
      { error: 'Missing required fields: itinerary, request, message' },
      { status: 400 }
    )
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `You are a travel planner refining an existing itinerary based on user feedback.

Current itinerary:
${JSON.stringify(itinerary)}

User request:
${message}

Original trip:
- Destination: ${request.destination}
- Duration: ${request.duration_days} days
- Budget: $${request.budget_usd} USD

Apply the requested changes while preserving the rest of the itinerary.
Keep total cost within budget.
Return ONLY raw JSON with the exact same structure. No markdown. No explanation.`

    const result = await model.generateContent([{ text: prompt }])
    const rawText = result.response.text()
    const refined = JSON.parse(cleanJson(rawText)) as ItineraryShape

    return NextResponse.json(refined)
  } catch (err) {
    console.error('Refine error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
