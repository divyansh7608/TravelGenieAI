'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorMessage } from '@/lib/auth/errors'
import { GoogleSignInButton } from '@/app/components/GoogleSignInButton'

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')

  // Shared state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Signup only state
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      window.location.href = '/dashboard'
    } catch (err: any) {
      console.error(err)
      setError(getAuthErrorMessage(err.message || 'Unable to sign in. Please try again.'))
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
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) throw signUpError

      setSuccess('Check your email to confirm your account.')

      // Attempt profile creation
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
    } catch (err: any) {
      console.error(err)
      setError(getAuthErrorMessage(err.message || 'Unable to create account. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          TravelGenieAI
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin')
                setError('')
                setSuccess('')
              }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signin'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup')
                setError('')
                setSuccess('')
              }}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signup'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
              {success}
            </div>
          )}

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="signin-email">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="signin-password">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="signin-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="signup-name">
                  Full Name
                </label>
                <div className="mt-1">
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="signup-email">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="signup-password">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="signup-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="signup-confirm">
                  Confirm Password
                </label>
                <div className="mt-1">
                  <input
                    id="signup-confirm"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <GoogleSignInButton />
            </div>
          </div>
          
          {/* Footer toggle */}
          <div className="mt-6 text-center text-sm">
            {activeTab === 'signin' ? (
              <p className="text-gray-600">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup')
                    setError('')
                    setSuccess('')
                  }}
                  className="font-medium text-gray-900 hover:text-gray-700"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p className="text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin')
                    setError('')
                    setSuccess('')
                  }}
                  className="font-medium text-gray-900 hover:text-gray-700"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
