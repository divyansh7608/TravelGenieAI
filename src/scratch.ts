import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testUpsert() {
  // First, sign in to get a session
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // Replace with their actual test email if known, but I don't know it.
    password: 'password123'
  })
}
