'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/errors'
import { signInWithGoogle } from '@/app/actions/auth'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}


export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const switchTab = (tab: 'signin' | 'signup') => {
    setActiveTab(tab)
    setError('')
    setSuccess('')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setError(getAuthErrorMessage(message || 'Unable to sign in. Please try again.'))
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) throw signUpError
      setSuccess('Check your email to confirm your account.')

      if (data.user) {
        try {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            avatar_url: '',
          })
        } catch (profileError) {
          console.error('Profile creation failed:', profileError)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setError(getAuthErrorMessage(message || 'Unable to create account. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200'

  return (
    <div
      className="min-h-screen flex flex-col justify-center py-8 px-4 sm:py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div className="mx-auto w-full max-w-sm sm:max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
            ✈️ TravelGenieAI
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">Sign in to save and manage your trips</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm p-5 sm:p-8 space-y-5 sm:space-y-6">

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)]">
            {(['signin', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
                }`}
              >
                {tab === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Success banner */}
          {success && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl">
              {success}
            </div>
          )}

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide" htmlFor="signin-email">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide" htmlFor="signin-password">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
                {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading && <Spinner />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide" htmlFor="signup-name">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide" htmlFor="signup-email">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide" htmlFor="signup-password">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide" htmlFor="signup-confirm">
                  Confirm Password
                </label>
                <input
                  id="signup-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
                {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading && <Spinner />}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[var(--card)] text-[var(--text-secondary)]">Or continue with</span>
            </div>
          </div>

          {/* Google Button */}
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg width="18" height="18" viewBox="0 0 488 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#4285F4" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C316.8 103.9 285 92 248 92c-94.5 0-170.8 76.3-170.8 164S153.5 420 248 420c82.7 0 143.2-47.6 158.4-113H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
              </svg>
              Continue with Google
            </button>
          </form>

          {/* Footer toggle */}
          <p className="text-center text-xs text-[var(--text-secondary)]">
            {activeTab === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button type="button" onClick={() => switchTab('signup')} className="text-blue-600 hover:underline font-medium">
                  Sign Up
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => switchTab('signin')} className="text-blue-600 hover:underline font-medium">
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
