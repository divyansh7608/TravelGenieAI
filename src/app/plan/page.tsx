'use client'

import { useState, useRef, useEffect } from 'react'
import type { GenerateRequest, ItineraryDay } from '@/types'
import type { ItineraryShape } from '@/lib/agent/orchestrator'
import { createClient } from '@/lib/supabase/client'
import { saveTrip, updateTripItinerary } from '@/lib/supabase/trips'
import { downloadItineraryAsDocx } from '@/lib/export/docx'
import { signInWithGoogle } from '@/app/actions/auth'

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressScreen({ currentStep }: { currentStep: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Building your itinerary…</h2>
        <p className="text-gray-500 text-sm">This may take up to 30 seconds</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        {STEPS.map((step, idx) => {
          const stepIndex = STEPS.findIndex((s) => s.id === currentStep)
          const done = idx < stepIndex
          const active = step.id === currentStep
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-300
                ${done ? 'border-green-200 bg-green-50' : ''}
                ${active ? 'border-blue-300 bg-blue-50' : ''}
                ${!done && !active ? 'border-gray-100 bg-gray-50 opacity-40' : ''}
              `}
            >
              {done ? (
                <span className="text-green-500 text-lg">✓</span>
              ) : active ? (
                <span className="inline-block w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
              ) : (
                <span className="inline-block w-4 h-4 rounded-full bg-gray-300" />
              )}
              <span className={`text-sm font-medium ${active ? 'text-blue-700' : done ? 'text-green-700' : 'text-gray-400'}`}>
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
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-medium">
        <span className={over ? 'text-red-600' : 'text-gray-700'}>
          ${spent.toLocaleString()} spent
        </span>
        <span className="text-gray-400">${total.toLocaleString()} budget</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
    <div className="max-w-3xl mx-auto space-y-8 py-10 px-4">
      {/* Header */}
      <div className="space-y-4">
        <button
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Plan another trip
        </button>
        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">{itinerary.title}</h1>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full border border-blue-200">
            💰 ${itinerary.total_cost_usd.toLocaleString()} total
          </span>
          <span className="px-3 py-1 bg-purple-50 text-purple-700 text-sm font-medium rounded-full border border-purple-200">
            📅 {itinerary.days.length} days
          </span>
          <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-200">
            ⭐ Best: {itinerary.best_time_to_visit}
          </span>
          {savedTripId && (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full border border-emerald-200">
              ✓ Saved
            </span>
          )}
        </div>
        <BudgetBar spent={itinerary.total_cost_usd} total={budget} />
      </div>

      {/* Guest upsell banner */}
      {!isSignedIn && (
        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
          <p className="text-sm text-blue-800">
            Sign in with Google to save this trip and access it anytime.
          </p>
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>
      )}

      {/* Days */}
      {itinerary.days.map((day) => (
        <div key={day.day} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Day {day.day}</p>
              <h2 className="text-xl font-bold">{day.title}</h2>
              <p className="text-sm text-gray-300 mt-0.5">{day.date}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-white/10 text-white text-sm rounded-full border border-white/20">
                ${day.budget_usd}
              </span>
              <p className="text-xs text-gray-400 mt-1">{day.weather}</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {day.slots.map((slot, i) => (
              <div key={i} className="px-6 py-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 w-20">
                      {slot.time}
                    </span>
                    <span className="font-medium text-gray-900">{slot.activity}</span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium shrink-0 ml-4">
                    ${slot.cost_usd}
                  </span>
                </div>
                {slot.tip && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                    💡 {slot.tip}
                  </p>
                )}
              </div>
            ))}
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <span>🏨</span>
                <span className="font-medium text-sm">{day.accommodation.name}</span>
              </div>
              <span className="text-sm text-slate-500">${day.accommodation.cost_usd}/night</span>
            </div>
          </div>
        </div>
      ))}

      {/* Packing tips */}
      {itinerary.packing_tips.length > 0 && (
        <div className="border border-gray-100 rounded-2xl p-6 space-y-3">
          <h3 className="font-bold text-gray-900">🎒 Packing Tips</h3>
          <ul className="space-y-2">
            {itinerary.packing_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-300 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Export buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleCopy}
          className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          {copied ? '✓ Copied!' : 'Copy as text'}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          Download as Word
        </button>
      </div>

      {/* ── Refinement chat ───────────────────────────────────────────────── */}
      <div className="border border-gray-100 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-gray-900">✏️ Refine this trip</h3>

        {/* Chat history */}
        {chatHistory.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-gray-100 text-gray-800 self-end'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                }`}
              >
                {msg.role === 'user' ? `You: ${msg.content}` : msg.content}
              </div>
            ))}
            {isRefining && (
              <div className="text-sm text-gray-400 italic px-3 py-2">
                Refining your trip…
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
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input + send */}
        <div className="flex gap-2">
          <input
            type="text"
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendRefine(refineInput) }}
            disabled={isRefining}
            placeholder="Ask anything — e.g. make day 2 more relaxed"
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition disabled:opacity-40"
          />
          <button
            onClick={() => handleSendRefine(refineInput)}
            disabled={isRefining || !refineInput.trim()}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

  const [phase, setPhase] = useState<'form' | 'loading' | 'result' | 'error'>('form')
  const [currentStep, setCurrentStep] = useState('')
  const [itinerary, setItinerary] = useState<ItineraryResult | null>(null)
  const [request, setRequest] = useState<GenerateRequest | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Auth + save state
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [savedTripId, setSavedTripId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false })

  // Refinement state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isRefining, setIsRefining] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // Check auth on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsSignedIn(true)
        setUserId(session.user.id)
      }
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

            // Auto-save for signed-in users — read session fresh
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

      // Keep saved trip in sync — read session fresh
      if (savedTripId) {
        try {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            await updateTripItinerary(savedTripId, session.user.id, refined as unknown as ItineraryShape)
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

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-white px-6">
        <div className="max-w-3xl mx-auto pt-10">
          <ProgressScreen currentStep={currentStep} />
        </div>
      </div>
    )
  }

  if (phase === 'result' && itinerary && request) {
    return (
      <div className="min-h-screen bg-white">
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
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="text-4xl">😕</div>
          <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
          <p className="text-gray-500 text-sm">{errorMessage}</p>
          <button
            onClick={() => { setPhase('form'); setErrorMessage('') }}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <span className="text-xl font-bold text-gray-900">TravelGenieAI</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plan your trip</h1>
          <p className="text-gray-500 mt-1">Tell us where you want to go and we'll do the rest.</p>
        </div>

        {/* Natural language description */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700" htmlFor="natural-input">
            Describe your trip
          </label>
          <textarea
            id="natural-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 5 days in Kyoto, October, $1500 budget, love temples and local food"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none transition"
            onBlur={(e) => {
              const text = e.target.value
              const inMatch = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)?.[1]
              if (inMatch && !destination) setDestination(inMatch)
            }}
          />
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-3 space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="destination">
              Destination *
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Paris, Kyoto, Bali…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="duration">
              Duration (days) *
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              max={30}
              value={duration}
              onChange={(e) => setDuration(Math.min(30, Math.max(1, Number(e.target.value))))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="budget">
              Budget (USD) *
            </label>
            <input
              id="budget"
              type="number"
              min={100}
              value={budget}
              onChange={(e) => setBudget(Math.max(100, Number(e.target.value)))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
            />
          </div>
        </div>

        {/* Interest tags */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Interests</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleInterest(tag)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150
                  ${interests.includes(tag)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Optional fields */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-800 list-none flex items-center gap-1 transition-colors">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Optional details
          </summary>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600" htmlFor="dates">
                Travel dates
              </label>
              <input
                id="dates"
                type="text"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="Oct 10 – Oct 15"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600" htmlFor="group-size">
                Group size
              </label>
              <input
                id="group-size"
                type="text"
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
                placeholder="Solo, couple, family of 4…"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-600" htmlFor="extra-notes">
                Extra notes
              </label>
              <textarea
                id="extra-notes"
                rows={2}
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                placeholder="Dietary restrictions, mobility needs, must-see places…"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition resize-none"
              />
            </div>
          </div>
        </details>

        {/* Submit */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!destination.trim()}
          className="w-full px-6 py-4 bg-gray-900 text-white text-base font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          Generate Itinerary ✨
        </button>
      </div>
    </div>
  )
}
