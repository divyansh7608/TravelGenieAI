// IMPORTANT:
// Set Supabase Email Confirmation URL to:
// http://localhost:3000/auth/confirm
// Production:
// https://travel-genie-ai-beige.vercel.app/auth/confirm

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | null

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      // redirect user to specified redirect URL or root of app
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(new URL('/auth?error=confirmation_failed', request.url))
}
