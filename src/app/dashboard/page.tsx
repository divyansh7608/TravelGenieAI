import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware guards this route, but guard defensively for type safety
  if (!user) {
    redirect('/')
  }

  const displayName =
    user.user_metadata?.full_name as string | undefined ??
    user.email ??
    'Traveller'

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-xl font-bold text-gray-900">TravelGenieAI</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </form>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        {/* Welcome */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {displayName}!
          </h1>
          <p className="text-gray-500">Here are your trips.</p>
        </div>

        {/* New trip CTA */}
        <Link
          href="/plan"
          className="inline-block px-6 py-3 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 transition-colors duration-200"
        >
          + New Trip
        </Link>

        {/* Empty state */}
        <div className="border border-dashed border-gray-200 rounded-xl py-20 text-center">
          <p className="text-gray-400 text-base">
            No trips yet — plan your first one.
          </p>
        </div>
      </main>
    </div>
  )
}
