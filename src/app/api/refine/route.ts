export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import type { GenerateRequest } from '@/types'

// ─── Rate limiter ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 20
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

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
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let body: Partial<RefineBody>

  try {
    body = (await req.json()) as Partial<RefineBody>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { itinerary, request, message } = body

  console.log('Refine request received:', {
    destination: request?.destination,
    message,
  })

  if (!itinerary || !request || !message) {
    return NextResponse.json(
      { error: 'Missing required fields: itinerary, request, message' },
      { status: 400 }
    )
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const prompt = `You are a travel planner refining an existing itinerary.

Current itinerary:
${JSON.stringify(itinerary)}

User request:
${message}

Original trip:
Destination: ${request.destination}
Duration: ${request.duration_days}
Budget: ${request.budget_usd}

Apply the requested changes while preserving the rest of the itinerary.

Return ONLY valid JSON.

No markdown.
No explanations.`

    const result = await model.generateContent([{ text: prompt }])
    const rawText = result.response.text()
    const refined = JSON.parse(cleanJson(rawText)) as ItineraryShape

    return NextResponse.json(refined)
  } catch (err) {
    console.error('Refine error:', err)
    const errMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
