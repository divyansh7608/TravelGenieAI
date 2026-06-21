export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import type { GenerateRequest } from '@/types'
import { runAgent } from '@/lib/agent/orchestrator'

// ─── Rate limiter ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let body: Partial<GenerateRequest>

  try {
    body = (await req.json()) as Partial<GenerateRequest>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { destination, duration_days, budget_usd } = body

  if (!destination || !duration_days || !budget_usd) {
    return NextResponse.json(
      { error: 'Missing required fields: destination, duration_days, budget_usd' },
      { status: 400 }
    )
  }

  const request: GenerateRequest = {
    destination,
    duration_days,
    budget_usd,
    interests: body.interests ?? [],
    dates: body.dates,
    group_size: body.group_size,
    extra_notes: body.extra_notes,
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of runAgent(request)) {
          controller.enqueue(encoder.encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
