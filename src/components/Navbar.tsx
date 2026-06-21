'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

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
    (user?.user_metadata?.full_name as string | undefined)?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    'U'

  const logoHref = user ? '/dashboard' : '/'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-[var(--bg)] border-b border-[var(--border)] transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">

        {/* Logo */}
        <Link
          href={logoHref}
          className="text-sm sm:text-base font-semibold text-[var(--text-primary)] hover:opacity-75 transition-opacity whitespace-nowrap"
        >
          ✈️ TravelGenieAI
        </Link>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <>
              {/* New Trip — hidden on mobile */}
              <Link
                href="/plan"
                className="hidden md:inline-flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 px-3 py-1.5"
              >
                New Trip
              </Link>

              <ThemeToggle />

              {/* Avatar dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center hover:bg-blue-700 transition-colors duration-200 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                >
                  {avatarLetter}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-11 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl py-1.5 z-50">
                    {/* Mobile: New Trip in dropdown */}
                    <Link
                      href="/plan"
                      onClick={() => setDropdownOpen(false)}
                      className="md:hidden flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      ✈️ New Trip
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      📊 Dashboard
                    </Link>
                    <div className="my-1 border-t border-[var(--border)]" />
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      ↩ Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                href="/auth"
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
