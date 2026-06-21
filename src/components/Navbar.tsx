'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const avatarLetter =
    (user?.user_metadata?.full_name as string | undefined)?.[0] ??
    user?.email?.[0] ??
    'U'

  const logoHref = user ? '/dashboard' : '/'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-16">
      <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link
          href={logoHref}
          className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
        >
          TravelGenieAI
        </Link>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-4">
            {/* New Trip link */}
            <Link
              href="/plan"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              New Trip
            </Link>

            {/* Avatar + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-9 h-9 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center hover:bg-gray-700 transition-colors uppercase"
                aria-label="User menu"
              >
                {avatarLetter}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-11 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link
            href="/auth"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
