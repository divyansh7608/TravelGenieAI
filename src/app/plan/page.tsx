'use client'

import { useState, useRef, useEffect } from 'react'
import type { GenerateRequest, ItineraryDay } from '@/types'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import { createClient } from '@/lib/supabase/client'
import { saveTrip, updateTripItinerary } from '@/lib/supabase/trips'
import { downloadItineraryAsDocx } from '@/lib/export/docx'
import { signInWithGoogle } from '@/app/actions/auth'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItineraryResult {
  title: string
  days: ItineraryDay[]
  total_cost_usd: number
  packing_tips: string[]
  best_time_to_visit: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StepConfig {
  id: string
  label: string
}

const STEPS: StepConfig[] = [
  { id: 'Searching for attractions and hotels', label: 'Searching attractions' },
  { id: 'Fetching weather forecast', label: 'Fetching weather' },
  { id: 'Calculating routes', label: 'Calculating routes' },
  { id: 'Reviewing and refining plan', label: 'Reviewing plan' },
]

const INTERESTS = [
  'Adventure', 'Culture', 'Food', 'Nature',
  'Shopping', 'Relaxation', 'History', 'Nightlife',
]

const REFINE_CHIPS = [
  'Make it cheaper',
  'Add more food',
  'Make it relaxed',
  'Add a day hike',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPlainText(itinerary: ItineraryResult): string {
  const lines: string[] = [
    `🌍 ${itinerary.title}`,
    `Total cost: $${itinerary.total_cost_usd}`,
    `Best time to visit: ${itinerary.best_time_to_visit}`,
    '',
  ]
  for (const day of itinerary.days) {
    lines.push(`── Day ${day.day}: ${day.title} (${day.date}) ──`)
    lines.push(`Weather: ${day.weather} | Budget: $${day.budget_usd}`)
    for (const slot of day.slots) {
      lines.push(`  [${slot.time}] ${slot.activity} — $${slot.cost_usd}`)
      if (slot.tip) lines.push(`    💡 ${slot.tip}`)
    }
    lines.push(`  🏨 ${day.accommodation.name} — $${day.accommodation.cost_usd}/night`)
    lines.push('')
  }
  if (itinerary.packing_tips.length > 0) {
    lines.push('🎒 Packing Tips:')
    itinerary.packing_tips.forEach((t) => lines.push(`  • ${t}`))
  }
  return lines.join('\n')
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      style={{ width: size, height: size }}
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressScreen({ currentStep }: { currentStep: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <div className="text-center space-y-2">
        <div className="text-4xl mb-2">✈️</div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Building your itinerary…</h2>
        <p className="text-[var(--text-secondary)] text-sm">This may take up to 30 seconds</p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        {STEPS.map((step, idx) => {
          const stepIndex = STEPS.findIndex((s) => s.id === currentStep)
          const done = idx < stepIndex
          const active = step.id === currentStep
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
                done
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
                  : active
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)] opacity-40'
              }`}
            >
              {done ? (
                <span className="text-green-500 text-lg font-bold">✓</span>
              ) : active ? (
                <span className="inline-block w-4 h-4 rounded-full bg-blue-500 animate-pulse shrink-0" />
              ) : (
                <span className="inline-block w-4 h-4 rounded-full bg-[var(--border)] shrink-0" />
              )}
              <span
                className={`text-sm font-medium ${
                  active
                    ? 'text-blue-700 dark:text-blue-300'
                    : done
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min(100, Math.round((spent / total) * 100))
  const over = spent > total
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm font-medium">
        <span className={over ? 'text-red-500' : 'text-[var(--text-primary)]'}>
          ${spent.toLocaleString()} spent
        </span>
        <span className="text-[var(--text-secondary)]">
          ${total.toLocaleString()} budget · {pct}%
        </span>
      </div>
      <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-400' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ItineraryView({
  itinerary,
  budget,
  onReset,
  request,
  savedTripId,
  isSignedIn,
  onRefine,
  chatHistory,
  isRefining,
}: {
  itinerary: ItineraryResult
  budget: number
  onReset: () => void
  request: GenerateRequest
  savedTripId: string | null
  isSignedIn: boolean
  onRefine: (message: string) => Promise<void>
  chatHistory: ChatMessage[]
  isRefining: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [refineInput, setRefineInput] = useState('')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(toPlainText(itinerary))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    await downloadItineraryAsDocx(itinerary as unknown as ItineraryShape, request.destination)
  }

  const handleSendRefine = async (msg: string) => {
    if (!msg.trim()) return
    setRefineInput('')
    await onRefine(msg.trim())
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-3 sm:px-4">
      {/* Header */}
      <div className="space-y-3">
        <button
          onClick={onReset}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
        >
          ← Plan another trip
        </button>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] leading-tight">
          {itinerary.title}
        </h1>

        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium rounded-full border border-green-200 dark:border-green-800">
            💰 ${itinerary.total_cost_usd.toLocaleString()} total
          </span>
          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full border border-blue-200 dark:border-blue-800">
            📅 {itinerary.days.length} days
          </span>
          <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-full border border-purple-200 dark:border-purple-800">
            📍 {request.destination}
          </span>
          {savedTripId && (
            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-full border border-emerald-200 dark:border-emerald-800">
              ✓ Saved
            </span>
          )}
        </div>

        {/* Best time banner */}
        {itinerary.best_time_to_visit && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
            ⭐ <span className="font-medium">Best time:</span> {itinerary.best_time_to_visit}
          </div>
        )}

        <BudgetBar spent={itinerary.total_cost_usd} total={budget} />
      </div>

      {/* Guest upsell */}
      {!isSignedIn && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl px-4 sm:px-5 py-4 text-white">
          <p className="text-sm font-medium">
            Sign in to save this trip and access it anytime.
          </p>
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full sm:w-auto shrink-0 px-4 py-2 bg-white text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Sign in
            </button>
          </form>
        </div>
      )}

      {/* Day cards */}
      {itinerary.days.map((day) => (
        <div key={day.day} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          {/* Day header */}
          <div className="px-3 sm:px-5 py-4 flex items-start justify-between gap-3 border-b border-[var(--border)]">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                  {day.day}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{day.title}</h2>
              </div>
              <p className="text-xs text-[var(--text-secondary)] ml-8 sm:ml-9 line-clamp-1">{day.date} · {day.weather}</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
              ${day.budget_usd}
            </span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {day.slots.map((slot, i) => (
              <div key={i} className="px-3 sm:px-5 py-3 space-y-1">
                {/* On mobile: time on top, activity + cost below */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 min-w-0">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] shrink-0">
                      {slot.time}
                    </span>
                    <span className="font-medium text-[var(--text-primary)] text-sm leading-snug">
                      {slot.activity}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-semibold shrink-0 mt-0.5">
                    ${slot.cost_usd}
                  </span>
                </div>
                {slot.tip && (
                  <p className="text-xs text-[var(--text-secondary)] italic pl-3 border-l-2 border-blue-300 dark:border-blue-700">
                    💡 {slot.tip}
                  </p>
                )}
              </div>
            ))}

            {/* Accommodation */}
            <div className="px-3 sm:px-5 py-3.5 flex items-center justify-between bg-[var(--bg-secondary)] gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">🏨</span>
                <span className="font-medium text-sm text-[var(--text-primary)] truncate">{day.accommodation.name}</span>
              </div>
              <span className="text-sm text-[var(--text-secondary)] shrink-0">${day.accommodation.cost_usd}/night</span>
            </div>
          </div>
        </div>
      ))}

      {/* Packing tips */}
      {itinerary.packing_tips.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 space-y-3">
          <h3 className="font-bold text-amber-900 dark:text-amber-200">🎒 Packing Tips</h3>
          <ul className="space-y-1.5">
            {itinerary.packing_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Export buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCopy}
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {copied ? '✓ Copied!' : '📋 Copy as text'}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ⬇️ Download as Word
        </button>
      </div>

      {/* Saved trip link */}
      {savedTripId && (
        <div className="text-center">
          <Link
            href={`/trip/${savedTripId}`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            View in Dashboard →
          </Link>
        </div>
      )}

      {/* Refinement chat */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-[var(--text-primary)]">✏️ Refine this trip</h3>

        {chatHistory.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {msg.role === 'user' ? `You: ${msg.content}` : msg.content}
              </div>
            ))}
            {isRefining && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] italic px-3 py-2">
                <Spinner size={14} /> Refining your trip…
              </div>
            )}
          </div>
        )}

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2">
          {REFINE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={isRefining}
              onClick={() => handleSendRefine(chip)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendRefine(refineInput) }}
            disabled={isRefining}
            placeholder="e.g. make day 2 more relaxed"
            className="flex-1 px-4 py-2.5 text-sm border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-40 placeholder-[var(--text-secondary)]"
          />
          <button
            onClick={() => handleSendRefine(refineInput)}
            disabled={isRefining || !refineInput.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, show }: { message: string; show: boolean }) {
  return (
    <div
      className={`fixed bottom-6 right-6 px-5 py-3 bg-emerald-600 text-white text-sm font-medium rounded-xl shadow-lg transition-all duration-300 z-50 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      ✓ {message}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [description, setDescription] = useState('')
  const [destination, setDestination] = useState('')
  const [duration, setDuration] = useState<number>(5)
  const [budget, setBudget] = useState<number>(1500)
  const [interests, setInterests] = useState<string[]>([])
  const [dates, setDates] = useState('')
  const [groupSize, setGroupSize] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [showMore, setShowMore] = useState(false)

  const [phase, setPhase] = useState<'form' | 'loading' | 'result' | 'error'>('form')
  const [currentStep, setCurrentStep] = useState('')
  const [itinerary, setItinerary] = useState<ItineraryResult | null>(null)
  const [request, setRequest] = useState<GenerateRequest | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [isSignedIn, setIsSignedIn] = useState(false)
  const [savedTripId, setSavedTripId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false })

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isRefining, setIsRefining] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setIsSignedIn(true)
    })
  }, [])

  const showToast = (message: string) => {
    setToast({ message, show: true })
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000)
  }

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleGenerate = async () => {
    if (!destination.trim()) return

    const req: GenerateRequest = {
      destination: destination.trim(),
      duration_days: duration,
      budget_usd: budget,
      interests,
      dates: dates || undefined,
      group_size: groupSize || undefined,
      extra_notes: description
        ? description + (extraNotes ? '. ' + extraNotes : '')
        : extraNotes || undefined,
    }
    setRequest(req)
    setSavedTripId(null)
    setChatHistory([])

    abortRef.current = new AbortController()
    setIsGenerating(true)
    setPhase('loading')
    setCurrentStep(STEPS[0].id)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        setErrorMessage('Something went wrong. Please try again.')
        setPhase('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const messages = buffer.split('\n\n')
        buffer = messages.pop() ?? ''

        for (const msg of messages) {
          if (!msg.trim()) continue
          const eventMatch = msg.match(/^event:\s*(.+)$/m)
          const dataMatch = msg.match(/^data:\s*(.+)$/m)
          const event = eventMatch?.[1]?.trim()
          const data = dataMatch?.[1]?.trim()

          if (!event || !data) continue

          if (event === 'status') {
            setCurrentStep(data)
          } else if (event === 'done') {
            const parsed = JSON.parse(data) as ItineraryResult
            setItinerary(parsed)
            setPhase('result')
            setIsGenerating(false)

            try {
              const supabase = createClient()
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                const tripId = await saveTrip(user.id, parsed as unknown as ItineraryShape, req)
                setSavedTripId(tripId)
                showToast('Trip saved to your dashboard')
              }
            } catch (saveErr) {
              console.error('Trip save failed:', saveErr)
            }
          } else if (event === 'error') {
            setErrorMessage(data)
            setPhase('error')
            setIsGenerating(false)
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setErrorMessage('Connection lost. Please check your network and try again.')
      setPhase('error')
    }
  }

  const handleRefine = async (message: string) => {
    if (!itinerary || !request || !message.trim()) return
    setIsRefining(true)
    setChatHistory((h) => [...h, { role: 'user', content: message }])

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary, request, message }),
      })

      if (!res.ok) throw new Error('Refinement failed')

      const refined = (await res.json()) as ItineraryResult
      setItinerary(refined)
      setChatHistory((h) => [...h, { role: 'assistant', content: 'Trip updated ✓' }])

      if (savedTripId) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await updateTripItinerary(savedTripId, user.id, refined as unknown as ItineraryShape)
          }
        } catch (updateErr) {
          console.error('Update trip failed:', updateErr)
        }
      }
    } catch (err) {
      console.error('Refine error:', err)
      setChatHistory((h) => [
        ...h,
        { role: 'assistant', content: 'Refinement failed, try again.' },
      ])
    } finally {
      setIsRefining(false)
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200'

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-3xl mx-auto">
          <ProgressScreen currentStep={currentStep} />
        </div>
      </div>
    )
  }

  if (phase === 'result' && itinerary && request) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <ItineraryView
          itinerary={itinerary}
          budget={budget}
          onReset={() => { setPhase('form'); setItinerary(null) }}
          request={request}
          savedTripId={savedTripId}
          isSignedIn={isSignedIn}
          onRefine={handleRefine}
          chatHistory={chatHistory}
          isRefining={isRefining}
        />
        <Toast message={toast.message} show={toast.show} />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="text-5xl">😕</div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Something went wrong</h2>
          <p className="text-[var(--text-secondary)] text-sm">{errorMessage}</p>
          <button
            onClick={() => { setPhase('form'); setErrorMessage('') }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg)] transition-colors duration-200">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Plan your trip ✈️</h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">
            Describe your trip below and we&apos;ll handle the rest
          </p>
        </div>

        {/* Form card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="natural-input">
              Describe your trip
            </label>
            <textarea
              id="natural-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 5 days in Kyoto, October, $1500 budget, love temples and local food"
              className={inputCls + ' resize-none'}
              onBlur={(e) => {
                const text = e.target.value
                const inMatch = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)?.[1]
                if (inMatch && !destination) setDestination(inMatch)
              }}
            />
          </div>

          {/* Core fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3 space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="destination">
                Destination *
              </label>
              <input
                id="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Paris, Kyoto, Bali…"
                className={inputCls}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="duration">
                Duration (days) *
              </label>
              <input
                id="duration"
                type="number"
                min={1}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Math.min(30, Math.max(1, Number(e.target.value))))}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="budget">
                Budget (USD) *
              </label>
              <input
                id="budget"
                type="number"
                min={100}
                value={budget}
                onChange={(e) => setBudget(Math.max(100, Number(e.target.value)))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Interest tags */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Interests
            </p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    interests.includes(tag)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* More options toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 flex items-center gap-1.5"
            >
              <span className={`inline-block transition-transform duration-200 ${showMore ? 'rotate-90' : ''}`}>▶</span>
              More options
            </button>

            {showMore && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="dates">
                    Travel dates
                  </label>
                  <input
                    id="dates"
                    type="text"
                    value={dates}
                    onChange={(e) => setDates(e.target.value)}
                    placeholder="Oct 10 – Oct 15"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="group-size">
                    Group size
                  </label>
                  <input
                    id="group-size"
                    type="text"
                    value={groupSize}
                    onChange={(e) => setGroupSize(e.target.value)}
                    placeholder="Solo, couple, family of 4…"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide" htmlFor="extra-notes">
                    Extra notes
                  </label>
                  <textarea
                    id="extra-notes"
                    rows={2}
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder="Dietary restrictions, mobility needs, must-see places…"
                    className={inputCls + ' resize-none'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!destination.trim() || isGenerating}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-base font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isGenerating ? (
              <>
                <Spinner size={18} />
                Generating…
              </>
            ) : (
              '✈️ Generate Itinerary'
            )}
          </button>
        </div>
      </div>
      <Toast message={toast.message} show={toast.show} />
    </div>
  )
}
