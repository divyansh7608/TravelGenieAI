'use client'

import { signInWithGoogle } from '@/app/actions/auth'

export function GoogleSignInButton() {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200"
      >
        {/* Google "G" logo SVG */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 488 512"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C316.8 103.9 285 92 248 92c-94.5 0-170.8 76.3-170.8 164S153.5 420 248 420c82.7 0 143.2-47.6 158.4-113H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
          />
        </svg>
        Continue with Google
      </button>
    </form>
  )
}
